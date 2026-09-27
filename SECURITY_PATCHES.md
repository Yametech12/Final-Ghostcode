# SECURITY_PATCHES.md — Critical Security Patch Pack

Orchestrator for the 15-patch security pack covering the audit findings across
all 10 domains. Every patch below was **applied and verified against the actual
code** — line-number drifts from the original audits are noted per patch.

**Status legend:** ✅ APPLIED · 📘 RUNBOOK (operational, no code) · 🔍 VERIFIED-NO-CHANGE (audit claim did not reproduce)

| ID | Fix | Type | Status |
|---|---|---|---|
| SEC-01 | Rotate leaked keys / treat project as compromised | Rotation runbook | 📘 RUNBOOK — history scan found **no committed secrets** |
| SEC-02 | .env.* → .gitignore/.vercelignore + untrack tsbuildinfo | Hygiene | ✅ APPLIED |
| SEC-03 | DROP world-readable legacy policies | SQL | ✅ APPLIED |
| SEC-04 | search_path pin + REVOKE PUBLIC on SECURITY DEFINER fns | SQL | ✅ APPLIED |
| SEC-05 | advisor_messages insert bound to session ownership | SQL | ✅ APPLIED (+ dropped surviving FOR ALL policy) |
| SEC-06 | Idempotent advisor_messages_update_reaction policy | SQL | ✅ APPLIED |
| SEC-07 | oracle/* added to rate-limit prefix lists (dev + prod) | Patch | ✅ APPLIED |
| SEC-08 | Rate limiter fails-CLOSED on RPC error | Patch | ✅ APPLIED |
| SEC-09 | handleAiChat model allow-list + max_tokens ceiling 4096 | Patch | ✅ APPLIED |
| SEC-10 | Authenticate /api/security/log + drop attacker ip/userId | Patch | ✅ APPLIED |
| SEC-11 | gitleaks pre-commit + CI scanner + history scan | Patch | ✅ APPLIED |
| SEC-12 | Server-side sanitizePromptField on inbound messages | Patch | ✅ APPLIED |
| SEC-13 | Sentry release tagging + source-map upload | Patch | ✅ APPLIED |
| SEC-14 | Per-user daily token ledger + 429 on exhaustion | Patch + SQL | ✅ APPLIED |
| SEC-15 | README corrections (routes 22→27, migrations 3→10, lock paragraph, license) | Patch | ✅ APPLIED |

---

## Apply order actually executed

1. **SEC-02 + SEC-11** (hygiene, scanners) — no behavior change, immediate hardening
2. **SEC-03 → SEC-04 → SEC-05 → SEC-06 → SEC-14(SQL)** — one idempotent migration
3. **SEC-07 + SEC-08 → SEC-09 → SEC-10 → SEC-12 → SEC-14(glue)** — API patches
4. **SEC-13 + SEC-15** — polish
5. **SEC-01** — runbook; scan results recorded below

---

## SEC-01 — Credential rotation runbook 📘

**What the audit claimed:** leaked OpenRouter + Supabase + Gmail keys in git
history; treat the project as compromised.

**What the scan actually found (this repo, full history, 2026-09-27):**

- `git log --all --diff-filter=A -- '.env*'` → only `.env.example` was ever
  committed. **No `.env`, `.env.local`, or `.env.production` blob exists in
  any commit.**
- Pickaxe scans for `sk-or` (OpenRouter prefix), `AIza` (Google prefix),
  `GMAIL_APP_PASSWORD=`, `SUPABASE_SERVICE_ROLE_KEY=eyJ` → **no hits**.
- `git log -S 'REGOLO_API_KEY='` → 1 commit (`558a2a0`), verified context:
  `.env.example:REGOLO_API_KEY=your_regolo_api_key_here` (placeholder) and the
  README template. **Not a secret.**

**Conclusion: no evidence of committed secrets in this repository's reachable
history.** The rotation runbook is still included because (a) the audit may
have scanned a different workspace state, and (b) keys shared in chats,
screenshots, or previous tooling remain exposed by definition. Rotating is
cheap insurance; skipping it when no leak exists is also defensible.

**Runbook (execute only for keys that were actually exposed somewhere):**

1. Supabase → Project Settings → API → **Rotate service role key** (old key
   dies immediately; update Vercel env + any CI secrets in the same breath).
2. Regolo dashboard → API keys → **revoke + re-issue**; update
   `REGOLO_API_KEY` in Vercel project settings.
3. Google account → Security → App passwords → **revoke the mail app
   password**; re-issue and update `GMAIL_APP_PASSWORD`.
4. If OpenRouter keys ever existed: platform.openai.com / openrouter.ai →
   keys → revoke all.
5. After rotation: `freebuff-deploy env list` (names only) to confirm every
   expected key is set in production, then redeploy.

**Ongoing detection:** SEC-11's nightly gitleaks full-history scan now runs
automatically.

---

## SEC-02 — Ignore-file hygiene ✅

**Applied:**

- `.gitignore`: replaced the four `.env.*` variants with `.env`, `.env.*`,
  `!.env.example`, `.env*.local`, `.env.production`, `.env.development`,
  `.env.test` — any new variant is ignored by default.
- `.vercelignore`: same wildcard set (env files never ship in deploys).
- `git rm --cached tsconfig.tsbuildinfo` — was tracked despite `*.tsbuildinfo`
  being ignored; now untracked.

**Verification:**
```bash
git check-ignore .env.production .env.local        # both must match
git check-ignore .env.example && echo BAD || echo OK   # must NOT be ignored
git ls-files | grep tsbuildinfo                    # must be empty
```

---

## SEC-03 — World-readable legacy policies ✅

The RLS audit migration (`20240101000100`) tightened field_reports / comments /
feedback to `TO authenticated`, but three `FOR SELECT USING (true)` policies
from the initial schema were **never dropped** because the audit's DROP
statements targeted different names. Permissive policies OR-combine, so the
anon-readable hole stayed open:

- `"Anyone can read feedback"` ON feedback (initial_schema.sql:272)
- `"Anyone can read likes"` ON report_likes (initial_schema.sql:302)
- `"Anyone can read public config"` ON public_config (initial_schema.sql:338;
  superseded by the audit's `TO authenticated` version)

**Applied:** all three DROPped in `20240101000900_security_patch_pack.sql`.
No client code reads these tables anonymously (verified: zero references to
`report_likes` / `public_config` / anonymous feedback reads in `src/`).

**Post-deploy verification (SQL editor):**
```sql
SELECT policyname FROM pg_policies
WHERE policyname LIKE 'Anyone can read%';
-- must return 0 rows
```

---

## SEC-04 — SECURITY DEFINER hygiene ✅

Both functions previously had no `search_path` pin (schema-qualified names
inside could be hijacked by a manipulated search_path) and were callable by
`PUBLIC` (including anon):

- `public.is_admin()` — `SET search_path = ''` + `REVOKE EXECUTE FROM PUBLIC`
  + `GRANT EXECUTE TO authenticated`
- `public.has_paid_subscription()` — same treatment

**Post-deploy verification (SQL editor):**
```sql
SELECT proconfig FROM pg_proc WHERE proname IN ('is_admin','has_paid_subscription');
-- both must show {search_path=""}

SELECT has_function_privilege('anon', 'public.is_admin()', 'execute');
-- must be false
```

---

## SEC-05 — advisor_messages writes bound to session ownership ✅

**Drift note:** the audit missed the *root* enabler. The initial schema's
`"Users can manage their own messages" FOR ALL` policy on advisor_messages was
never dropped by the RLS audit (which created same-purpose-but-differently-named
policies). Even with a perfect INSERT policy, Postgres OR-combines permissive
policies — the FOR ALL policy alone would have kept the hole open.

**Applied (migration 00900):**

1. `DROP POLICY "Users can manage their own messages"` (the FOR ALL bypass)
2. Recreated SELECT/DELETE owner-scoped (unchanged semantics)
3. **INSERT** now requires `auth.uid() = user_id` **AND** the target session
   to exist in `advisor_sessions` with `user_id = auth.uid()`
4. **UPDATE** (see SEC-06) carries the same session-ownership check

**Post-deploy verification:** attempt an insert with a session_id owned by
another account via the anon/authenticated REST API — must fail with RLS
violation (42501).

---

## SEC-06 — Idempotent reaction policy ✅

`20240101000800` created `advisor_messages_update_reaction` with a plain
`CREATE POLICY` (re-running the migration errors). The new migration DROPs it
first and recreates it with `TO authenticated` and the session-ownership
EXISTS check — idempotent by construction (every statement uses
`IF EXISTS` / `IF NOT EXISTS` discipline).

---

## SEC-07 — Rate-limit the oracle paths ✅

`/api/oracle/*` (analyses insert / tasks patch / delete) spends Regolo tokens
on insert but was missing from **both** rate-limit prefix lists, so it was
effectively unmetered:

- `api/_index.ts` dev middleware: added `req.path.startsWith('/api/oracle')`
- `api/server.ts` Vercel path: added `pathname.startsWith('oracle/')`

Oracle inserts now share the AI bucket (15/min/IP on Vercel, 10/min in dev)
on top of the existing per-user bucket and the new SEC-14 ledger.

**Post-deploy verification:**
```bash
# with a valid JWT, hammer /api/oracle/analyses 11× in a minute
# expected: 429 RATE_LIMITED by request 16 (15/min/IP); before this patch: unlimited
```

---

## SEC-08 — Rate limiter fails CLOSED ✅

**Drift note:** the audit located this at `_index.ts` — the fail-open path
actually lived in `api/server.ts` (the Vercel production entry), where an RPC
error merely logged `rate_limit_rpc_failed` and allowed the request. One
missing/broken SQL function silently disabled ALL metering.

**Applied:** `api/server.ts` now returns `503 RATE_LIMITER_UNAVAILABLE` when
the RPC errors, and logs at `error` level (`rate_limit_rpc_failed_blocking`).
Rationale: a missing migration is a deploy-time bug; a broken rate limiter
must stop traffic, not unbill it. The per-user limiter's catch block remains
fail-open (it only wraps the *additional* per-user check after the primary
gate has already passed) — availability risk is bounded by the primary
fail-closed limiter.

---

## SEC-09 — Model allow-list + token ceiling ✅

`handleAiChat` forwarded client-supplied `model` and `max_tokens` verbatim to
Regolo. Applied in `api/lib/handlers.ts`:

- `ALLOWED_CLIENT_MODELS` = `{ DEFAULT_MODEL, VISION_MODEL, ...FALLBACK_MODELS }`
  (from `api/_config.ts`) — anything else → 400 `MODEL_NOT_ALLOWED`
- `safeMaxTokens = min(client_value || 4096, 4096)` — non-numeric/zero/
  negative values fall back to 4096, and the ceiling is absolute

---

## SEC-10 — /api/security/log now authenticated ✅

**Applied:**

- `handleSecurityLog`: 401 without a JWT; `userId` is **always**
  `req.user.id` (the body's `userId`/`ip` fields are ignored and the `ip`
  field is dropped entirely — edge/platform logs remain authoritative);
  email redaction and payload caps unchanged.
- `api/_index.ts` + `api/server.ts`: the CSRF exemption for
  `security/log` removed — it now requires `X-Requested-With` like every
  other POST. (`apiFetch` always sends it; the endpoint has **zero client
  callers today**, verified — this endpoint exists for future client use.)
- Dev rate limit comment updated (bucket unchanged at 30/min/IP).

**Test impact:** the 4 existing `handleSecurityLog` tests updated — no-JWT →
401, and the "logs valid payloads" test now expects server-derived userId.

---

## SEC-11 — Secret scanning ✅

**Applied:**

- `.gitleaks.toml` — extends gitleaks defaults; allowlists `.env.example`
  placeholders, lockfiles, and `supabase/` SQL fixtures
- `.github/workflows/secret-scan.yml` — gitleaks on every push/PR +
  **nightly full-history scan** (03:00 UTC) + manual dispatch
- `scripts/hooks/pre-commit` — staged-changes scan; soft-skips when gitleaks
  isn't installed (CI is the hard gate). Enable with:
  `git config core.hooksPath scripts/hooks`

**Baseline history scan (recorded above in SEC-01): clean — no committed
secrets found.**

---

## SEC-12 — Server-side prompt sanitization ✅

New module `api/lib/sanitizePrompt.ts`:

- strips control chars (`\u0000-\u0008`, `\u000B\u000C`, `\u000E-\u001F`,
  `\u007F`), zero-width/bidi-override characters (`\u200B-\u200F`,
  `\u202A-\u202E`, `\u2060-\u2064`, `\uFEFF`)
- neutralizes role-spoofing lines (`system:` / `assistant:` / `developer:` /
  `tool:` prefixes at line start → `user:`) — kills the classic
  chat-history injection vector
- length caps per field class (`chatMessage` 12k, `systemPrompt` 8k,
  `title` 200, `generic` 4k)

**Wired into every inbound AI path:**

- `handleAdvisorChatStream`: user message sanitized before persistence AND
  dispatch (empty-after-sanitize → 400)
- `handleAiChat`: whole messages array through `sanitizeMessageArray`
  (multimodal `text` parts included); image data URLs preserved via the
  oversized `maxLength` for the array pass, extracted text re-sanitized
  per part

---

## SEC-13 — Sentry release tagging + sourcemaps ✅

**Applied:**

- `vite.config.ts`: `__SENTRY_RELEASE__` define baked at build time from
  `SENTRY_RELEASE || VERCEL_GIT_COMMIT_SHA || GITHUB_SHA`; `sourcemap:
  'hidden'` (maps generated, never referenced publicly)
- `src/lib/sentry.ts`: client `Sentry.init({ release })`
- `api/lib/sentryNode.ts`: server `Sentry.init({ release })` (same env chain)
- `scripts/upload-sourcemaps.mjs`: uploads dist maps to Sentry for the
  release, then deletes local copies; no-ops when secrets absent; wired into
  `npm run build` after the SW-version injection
- Required secrets (add in Vercel settings when adopting):
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

---

## SEC-14 — Per-user daily token ledger ✅

**SQL (migration 00900):** `ai_token_usage` table (PK `user_id, day`),
RLS enabled with **no policies** (zero direct client access — only the
definer function writes), plus `consume_ai_tokens(p_user_id, p_model,
p_estimated_tokens, p_daily_cap)` — atomic `FOR UPDATE` reserve that returns
`(tokens_used, allowed)` and refuses when the cap would be exceeded.
`EXECUTE` granted to `service_role` only.

**Client (`api/lib/aiBudget.ts`):**

- `estimateTokens` / `estimateMessagesTokens` — ~4 chars/token +10% headroom,
  images at a conservative flat 1200
- `DAILY_CAPS = { strategist: 120_000, oracle: 400_000 }` (tune per economics)
- `consumeDailyTokens` — wraps the RPC; ledger *errors* fail open with
  `ledgerError: true` (the fail-closed per-minute limiter still bounds abuse;
  availability beats a hard outage of one table)

**Wired into both spend paths (post-tier-gate, pre-dispatch):**

- `handleAdvisorChatStream`: est = user message + 1500 (system prompt +
  history + reply headroom) → `429 DAILY_BUDGET_EXCEEDED` when exhausted
- `handleAiChat`: est = all messages + 800 → same 429 shape

**Post-deploy verification (SQL editor):**
```sql
SELECT * FROM consume_ai_tokens(
  '550e8400-e29b-41d4-a716-446655440000'::uuid, 'test', 999999, 100);
-- must return allowed=false
```

---

## SEC-15 — README corrections ✅

- "canonical schema is in supabase-schema-v2.sql" → migrations are canonical
  (**10** migrations, not 3) — legacy file called out as non-authoritative
- route count **22 → 27** (verified against AnimatedRoutes.tsx: 28 `path=`
  entries minus the catch-all)
- deployment instruction "run all three SQL files" → run every migration in
  lexicographic order
- no-op-lock caveat → describes the current per-name async mutex
- license posture: explicitly proprietary, no LICENSE file, do not publish

---

## Post-deploy verification checklist

```bash
# SEC-01/02: no secrets in history or worktree
git log --all --oneline --diff-filter=A -- '.env*'        # only .env.example
git ls-files | grep tsbuildinfo                            # empty

# SEC-11: scanner present
gh workflow list | grep -i secret

# SEC-05/06/03/04 (SQL editor, after applying migration 00900):
#   SELECT policyname FROM pg_policies WHERE policyname LIKE 'Anyone can read%';  -- 0 rows
#   SELECT has_function_privilege('anon','public.is_admin()','execute');          -- false
#   insert into another user's advisor session → 42501

# SEC-07/08: rate limiter live
#   16 rapid POSTs to /api/oracle/analyses with a JWT → 429 by #16
#   (temporarily rename the RPC to test 08 → expect 503 RATE_LIMITER_UNAVAILABLE)

# SEC-09: model spoof rejected
#   curl /api/ai/chat -d '{"model":"gpt-4o", ...}' → 400 MODEL_NOT_ALLOWED

# SEC-10: unauthenticated logging rejected
#   curl -X POST /api/security/log -d '{"event":"x"}' → 401

# SEC-14: budget gate live
#   SELECT * FROM consume_ai_tokens('...uuid','t',999999,100);  -- allowed=false
```
