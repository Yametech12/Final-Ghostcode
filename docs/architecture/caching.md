# Caching Architecture

How Epimetheus caches across a serverless deployment, why the cache is
REST-based, and what happens when Redis is unreachable.

- **Code:** `api/lib/cache.ts` (cache layer), `api/lib/tierGate.ts` (tier cache),
  `api/_index.ts` (rate limiting), `api/lib/featuredCaches.ts` (hot static reads)
- **Client:** `@upstash/redis`
- **Env:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, optional `REDIS_KEY_PREFIX`

---

## 1. Why this exists

The original implementation used module-level `Map` instances:

```ts
const tierCache = new Map<string, TierEntry>();                    // api/lib/tierGate.ts
const rateLimitStore = new Map<string, { count: number; resetTime: number }>(); // api/_index.ts
```

A `Map` is per-process. On Vercel that means:

| Problem | Effect |
|---|---|
| Each cold start gets a fresh, empty cache | The tier lookup hits Supabase on nearly every request; the cache warms and dies. |
| Each concurrent instance has its own rate-limit counter | A client can send `limit × instances` requests. The limit becomes a suggestion. |
| Multi-region deployments fragment the counters | Two regions, two allowances. |
| Entries never expire from the store | A long-lived instance accumulates keys with no bound. |

Moving the counters to shared Redis fixes the semantics. The two-tier design
below keeps the latency of a DB read off the hot path while making the shared
state authoritative.

---

## 2. Two-tier model

```
                       ┌────────────────────────────────────────┐
  gated API call  ──▶  │  Tier 1: process-local shadow cache    │
                       │  Map, ~1s TTL, 1 000 entries max       │
                       └───────────────┬────────────────────────┘
                                       │ miss
                                       ▼
                       ┌────────────────────────────────────────┐
  any instance    ──▶  │  Tier 2: Upstash Redis (REST/HTTPS)    │
                       │  tier:<userId>        30 s TTL         │
                       │  rate:<bucket>:<ip>   window TTL       │
                       │  prompt:*             300 s TTL        │
                       │  catalog:*            3 600 s TTL      │
                       └───────────────┬────────────────────────┘
                                       │ miss / error
                                       ▼
                       ┌────────────────────────────────────────┐
                       │  Origin: Supabase (or an in-process    │
                       │  constant, for static prompt text)     │
                       └────────────────────────────────────────┘
```

**Tier 2 (Redis) is authoritative.** It is the only layer that survives a cold
start and the only one every instance agrees on.

**Tier 1 (process-local) exists purely to remove latency.** A page that fires
three gated calls within the same second would otherwise pay three HTTP round
trips to Upstash. The shadow TTL is ~1 s and the entry additionally honours the
real `expiresAt`, so it can never serve a stale verdict after the underlying
entry dies. Tier 1 is bounded (`MAX_SHADOW_ENTRIES`, `MAX_TIER_CACHE_ENTRIES`)
and evicts the oldest key on write.

**The shadow layer is not a correctness boundary.** Anything Tier 1 can do,
Tier 2 must also be able to do — because the next request may land on a
different instance with a cold Tier 1.

---

## 3. Why REST instead of TCP

Upstash offers both. We use `@upstash/redis`, which speaks HTTP(S).

| Concern | TCP (`redis://`, ioredis/node-redis) | REST (`@upstash/redis`) |
|---|---|---|
| Serverless freeze/thaw | Sockets are torn down when the instance freezes; every cold start re-pays DNS + TLS + AUTH | Stateless HTTPS request; nothing to rebuild |
| Connection pool | Needs a pool per instance; concurrent lambdas multiply connections | One HTTP client, no pool to cap |
| Edge runtime | Not available | Works (fetch-based) |
| Local Express dev | Works | Works |
| Cost of a single op | Lower per-op overhead once warm | One HTTPS round trip |

The deciding factor is the platform contract: a Vercel function is not a
long-running process, so the thing TCP optimises for (reusing a warm
connection) is exactly the thing that does not survive. Paying one HTTPS round
trip per cache miss is the correct trade against reconnecting on every cold
start.

---

## 4. Failure semantics — degraded, never silently open

This is the part that matters most for a security control like tier gating and
rate limiting.

### 4.1 Configuration missing

If `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is empty, the module
logs **one** warning (`upstash_not_configured`) and serves everything from the
bounded process-local store.

* Reads and writes keep working — the scope is per-instance, not global.
* `redisAvailable` is `false` and `cacheMode` is `'process-local'`; the Express
  boot log prints the mode so a misconfigured deploy is visible in the logs.
* The Supabase SDK is never imported in this mode: the import is dynamic and
  only runs when Redis is configured. No env var means no network client.

Consequence to be explicit about: with no Redis, rate limiting is per-instance,
so the effective global limit is `limit × live instances`. That is a
**degradation**, not a bypass — a single instance still enforces the configured
limit. Configure Upstash in production.

### 4.2 A Redis call throws

Every method is wrapped. On error the cache layer:

1. logs `[cache] <op>_failed` with the **key** and the **error message**
   — never the cached value, which may be `tier` data;
2. degrades to the same bounded local store.

So a Redis outage is absorbed rather than propagated:

* `get` → falls back to the local copy, returns `null` on a cold local store,
  and the caller reads the origin.
* `set` → writes locally; the request succeeds.
* `incr` (rate limiting) → increments a local counter **that still enforces the
  configured limit**. This is the critical one: failing open here would let an
  attacker disable rate limiting by breaking Redis. Instead the limit degrades
  from global to per-instance.
* `del` → clears the local copy first (so an un-awaited caller still observes
  the invalidation on its own instance), then attempts the remote delete.

`withCache` follows the same rule: a read failure logs and runs the fallback; a
write failure logs and still returns the freshly computed value. A broken cache
degrades performance, never correctness.

### 4.3 The origin fails

Distinct from a cache failure, and handled differently:

* **Tier gate:** a Supabase error returns HTTP 503
  (`SUBSCRIPTION_LOOKUP_FAILED`) rather than a 402 or an allow. Just as
  importantly, the `'free'` default is **not written** to the shared cache — a
  transient DB blip must not poison Redis with a wrong verdict for 30 s across
  every instance and region.
* **Prompt blocks:** the loader is a pure in-process constant, so a miss always
  resolves. The advisor system prompt can never come out empty.
* **`withCache` + a throwing loader:** the error propagates. A failed origin is
  not disguised as a cache failure.

### 4.4 Value integrity

Values are stored as `{ "v": <value> }` and the client is constructed with
`automaticDeserialization: false`. This is deliberate:

* a cached `0`, `false`, `""` or `null` cannot be mistaken for a miss;
* a value that merely *looks* like JSON is not silently re-parsed by the SDK;
* a foreign or corrupted entry is rejected by a shape guard
  (`isTierEntry`) and the code falls back to the origin instead of trusting it.

---

## 5. Key namespaces and TTL conventions

| Key | TTL | Purpose | Cached by |
|---|---|---|---|
| `tier:<userId>` | 30 s, clamped to the subscription's own expiry | Effective `role` + `tier` for a user | `tierGate.ts` |
| `rate:<bucket>:<ip>` | bucket window (60 s, or 300 s for account delete) | Fixed-window request counter | `_index.ts` |
| `prompt:advisor:type-framework` | 300 s | Static type-framework prompt block | `featuredCaches.ts` |
| `prompt:advisor:response-guidelines` | 300 s | Static guidelines + examples block | `featuredCaches.ts` |
| `prompt:advisor:type-context:<TYPE_ID>` | 3 600 s | One-line context sentence per type | `featuredCaches.ts` |
| `catalog:personality-types` | 3 600 s | The full 8-type catalog | `featuredCaches.ts` |

Rules the TTLs encode:

1. **Anything user-visible is short.** A 30 s tier TTL means a Stripe upgrade
   or a manual admin change becomes effective within 30 s even without an
   explicit invalidation. `invalidateTierCache(userId)` drops both tiers for an
   immediate flip.
2. **Never outlive the underlying entitlement.** The tier entry's `expiresAt` is
   `min(now + TTL, subscription_expires_at)`, and `expire` is never allowed to
   outlast it. A lapsed subscription cannot be extended by a cache hit.
3. **Fixed window, not sliding.** `incr` sets the TTL only on the call that
   creates the key (`next === 1`). Refreshing the TTL on every request would let
   a steady client hold a key forever and never reset.
4. **Only user-independent data is cached long.** The 1 h entries are prompt
   text, a lookup table and a static catalog. No user id, email, trait score or
   message body is cached — the per-user half of the advisor prompt is
   reassembled on every request by design.

`REDIS_KEY_PREFIX` optionally namespaces every key. Set it when staging and
production share one Redis database, so the environments cannot read each
other's cached tiers.

---

## 6. Rate limiting: Redis and the database

Two counters exist, and they are not redundant:

* **Redis** (`rate:<bucket>:<ip>`) — the Express/dev path and the cheap
  per-request gate for short windows. Sub-millisecond, no Postgres write.
* **Postgres** (`record_and_count_rate_limit`) — the atomic durable counter used
  where the limit is a business rule that must hold across every instance and
  survive a Redis flush.

Redis is the fast path; Postgres is the authority. A Redis failure degrades to
the bounded local counter described in §4.2.

---

## 7. Operational notes

**Inspect what is cached:**

```bash
curl -s "$UPSTASH_REDIS_REST_URL/keys/tier:*" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

**Force a tier re-read for one user** — from application code, call
`invalidateTierCache(userId)`; it drops the shadow entry and the Redis key.

**Rebuild the featured (static) entries** after shipping a prompt change:

```ts
import { invalidateFeaturedCaches } from './featuredCaches.js';
await invalidateFeaturedCaches();
```

They also expire on their own within 300 s, so a missed invalidation is
self-healing.

**Confirm the mode in production:** the boot log prints
`Cache mode: redis` or `Cache mode: process-local (set UPSTASH_REDIS_REST_URL/TOKEN for a shared cache)`.
`process-local` in production means the Upstash env vars are missing.

---

## 8. Deliberately out of scope

* `api/_config.ts` and `api/lib/auth.ts` keep their own short-lived in-process
  caches (provider config, JWT verification). They are warm-path latency
  optimisations on data that is already per-request-validated, not shared
  state, so they stay in-process.
* Frontend caches (TanStack Query, the Zustand store and `localStorage`
  fallbacks) are unaffected; they are client-side by design.
* Redis pub/sub for cache invalidation across instances is not used. The TTLs
  are short enough that a stale entry cannot outlive its usefulness, which
  keeps the failure modes simple.
