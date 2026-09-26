# Monitoring & Observability

**Last verified: 2026-09-26** · against commit `37c2505f487fd1d43ab73eb7ec3d909767e7546f` (2026-09-12)

> **How to read this document.** This is a map of what the code *can* emit, based
> on the source. There is **no live dashboard, no alerting, and no on-call** — none
> of that exists in the repository. Where a signal is documented as available, it
> means the code produces it; it does not mean anyone is watching it.

---

## 1. What exists

| Signal | Mechanism | Where |
| --- | --- | --- |
| Structured logs | `log.info/warn/error` with JSON payloads | `api/lib/log.ts` (212 lines) |
| Request IDs | `requestIdFrom(headers)` → truncated into error responses | `api/lib/log.ts` |
| Server errors | `initSentryNode()`, `captureException()` | `api/lib/sentryNode.ts` (154 lines) |
| Client errors | `initSentry`, `captureException`, `setUser`, `clearUser` | `src/lib/sentry.ts` (125 lines) |
| React render errors | `ErrorBoundary`, `SessionErrorBoundary` | `src/components/` |
| Web vitals | Performance instrumentation hook | `src/hooks/usePerformance.ts` |
| AI test surface | `handleTestKey` | `api/lib/handlers.ts` |
| Health check | `handleHealth` | `api/lib/handlers.ts` |
| Service-worker version | Stamped at build time | `scripts/inject-sw-version.mjs` |

**What does not exist:** APM tracing, a metrics backend, log aggregation, an
uptime monitor, alert routing, a status page, or a stored dashboard. Adding a log
line today means it goes to platform stdout and nobody is notified.

---

## 2. Sentry

Optional in both directions. **No DSN means the integration is a no-op** — that is
deliberate, so local development and contributor checkouts need no Sentry account,
but it also means a deployment can silently have zero error reporting.

### Two DSNs, for a reason

| Variable | Bundled into the client? | Catches |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | **Yes** — visible to every visitor | React errors, unhandled rejections in the browser |
| `SENTRY_DSN` | No, server-only | Express and Vercel function errors |

They may be the same DSN (one project, two streams) or different ones (separate
projects per runtime). The client DSN being public is expected — a DSN authorises
event *submission*, not data *reading* — but the server DSN should never be
`VITE_`-prefixed.

### Verify it is actually receiving events

```bash
# Server side: a DSN that is set but wrong looks identical to a DSN that is right
# until an error happens. Force one:
curl -s "$DOMAIN/api/health" > /dev/null
# Then check the Sentry project's Issues feed for a corresponding event.

# Client side: reload the site with devtools open and confirm a request to
# ingest.sentry.io (or your self-hosted host) appears in the Network tab.
```

**If no ingest request appears, Sentry is off** — most commonly a missing DSN, or
the lazy `loadSentry()` never resolving because the module failed to load.

### Known weakness: the redundant dynamic import

`src/lib/sentry.ts` previously called `await import('@sentry/react')` on every
invocation instead of reusing the already-resolved module. The performance patch
introduced a module-scope handle so the SDK is resolved once — it stays lazy
(absent from the initial bundle) but is not re-resolved per call. **That patch is
not applied to `main`.**

---

## 3. Logs and request IDs

### The request-ID contract

Every request can carry a correlation id, and **an unhandled throw returns a
truncated form of it to the client**:

```ts
log.error('handler_unhandled', {
  requestId,
  route: `${res.req.method} ${res.req.path}`,
  userId: normReq.user?.id,
  err: serializeErr(err),
  _skipSentry: true,          // the log forwarder handles it
});
captureException(err, { requestId, route, userId: normReq.user?.id });

if (!res.headersSent) {
  res.status(500).json({ error: 'Internal error', requestId: requestId.slice(-12) });
}
```

**Why this is the most useful thing in the observability layer.** Without it, a
"something went wrong" report is unactionable. With it, the user quotes twelve
characters and you can find the exact request — **but only if logs are retained
somewhere searchable.** On Vercel the logs live in the deployment's log view and
expire. If you want this contract to hold beyond a few hours, ship logs to a
retention store.

### What is deliberately not logged

Secrets, tokens, request bodies in full, and user message content. `serializeErr`
extracts `name`, `message`, and `stack` rather than spreading the error object,
because spreading can pick up attached request data. Any new log line containing a
user field should be reviewed against this rule — a leaked token in a log line is
a leaked token.

---

## 4. Health and liveness

```bash
curl -s $DOMAIN/api/health
```

`handleHealth` reports status plus feature flags. It **does not** verify the
database, so a `200` means the function booted, not that Supabase is reachable. A
health check that never fails is not a health check — treat it as a liveness
signal only.

For a real readiness probe you need a query behind it:

```sql
-- The query to put behind a readiness endpoint
select 1;
```

**Not yet implemented.** Today, a Supabase outage presents as a wave of `500`s
from data-dependent routes with `/api/health` still green — which is the signal
that matters and the one that is missing.

---

## 5. Signals worth watching

Ranked by how early they predict a user-visible problem.

| # | Signal | Where | Why it matters |
| --- | --- | --- | --- |
| 1 | `429` rate on `/api/*` | Function logs | Either abuse or a limit too tight for real use. Distinguish by user id. |
| 2 | **AI provider failures + latency** | `_config.ts` call sites | The advisor is the core feature; a provider outage is a product outage, and it is invisible from the app server's own metrics. |
| 3 | Function duration p95 | Vercel dashboard | A jump usually means an upstream AI call is hanging, not that the code got slower. |
| 4 | **Supabase connection errors** | Handler logs | Presents as scattered `500`s across unrelated routes — easy to misread as many bugs instead of one dependency failure. |
| 5 | `500` rate by route | Logs | A spike on one route is a regression; a spike everywhere is infrastructure. |
| 6 | Web-vitals p75 (LCP, INP, CLS) | `usePerformance.ts` | The font and scroll issues in the performance audit show up here first. |
| 7 | Sentry event volume | Sentry | A new error type appearing is the leading indicator of a bad deploy. |
| 8 | Failed deploys | Vercel | Especially the secret-leak guard aborting — that is a *saved* incident, not a failure. |
| 9 | **Service-worker version churn** | `dist/sw.js` | A version that does not change on deploy means users keep a stale cached bundle. |
| 10 | Advisors' upstream cost | Regolo dashboard | Denial-of-wallet is quiet; nothing in this app will tell you the AI bill is climbing. |

**Signals that do not exist yet:** database connection-pool saturation, storage
egress, per-user AI cost, webhook delivery failures (no webhooks), and a
synthetic uptime check from outside Vercel.

---

## 6. Investigating a production error

**Step 1 — get the request ID.** Ask for it. The `500` response body contains it as
`requestId`. Without it, you are searching by timestamp, and timestamps are not
unique under load.

**Step 2 — find the log line.**

```bash
# Vercel CLI, for the deployment in question
vercel logs <deployment-url> --since 1h
# Then search the output for the requestId.
```

**Step 3 — classify before you fix.**

| Symptom | Likely cause | First check |
| --- | --- | --- |
| `401` everywhere, app-wide | JWT verification failing — key rotation, clock skew, or Supabase auth degraded | `curl $DOMAIN/api/health`; Supabase status page |
| `403 CSRF_CHECK_FAILED` from the real client | The request lost `Content-Type: application/json` | Network tab, the actual request headers |
| `429` for legitimate users | Rate-limit bucket shared across users — no `trust proxy` on a proxied self-host | Check whether the deploy is behind a proxy |
| `500` on one route only | A code regression | `vercel logs` for that route; the stack from Sentry |
| `500` on many unrelated routes | **One dependency down** (Supabase) | `select 1` against the database |
| Advisor slow, then works | An upstream AI call hanging, then timing out | Regolo status; p95 function duration |
| Advisor reply arrives all at once | **SSE is being buffered** — compression middleware intercepting `text/event-stream` | Response headers; whether `compression()` is active |

That last row is worth internalising: the streaming route silently degrades into a
slow non-streaming response if a compression filter does not exclude
`text/event-stream`. It looks like slowness, not breakage.

**Step 4 — reproduce locally.** `npm run dev`, then `npm run diagnose` for an env
and Supabase smoke test.

**Step 5 — if it is a bad deploy, roll back first and diagnose after.** Vercel →
Deployments → the previous **Promote to Production**. Users are waiting; the root
cause will still be there in ten minutes.

---

## 7. What to add, in order

| # | Addition | Why it is first |
| --- | --- | --- |
| 1 | **Real readiness probe** (a DB query behind a separate endpoint) | Today a Supabase outage is indistinguishable from many unrelated bugs |
| 2 | **Error alerting** — Sentry → email or Slack on new issue types | Errors are collected and nobody is told |
| 3 | **Log retention** outside the platform | The request-ID contract expires with the deployment log |
| 4 | **Uptime check** from outside Vercel | Catches DNS, TLS, and routing failures the app cannot see |
| 5 | **AI cost tracking** | Denial-of-wallet is currently invisible |
| 6 | **Per-user AI usage counter** | Turns "the bill is high" into "this account is the cause" |
| 7 | **Synthetic streaming check** | The SSE-buffering regression is silent and user-visible |
| 8 | **Web-vitals dashboard** | Data is collected by `usePerformance.ts` and goes nowhere |
| 9 | **Deploy annotations** in the error stream | Without them, a spike cannot be correlated with a release |
| 10 | **Status page** | For when the AI provider is down and the answer is "it's them, not us" |

---

## 8. Runbook shortcuts

| Question | Answer |
| --- | --- |
| Is the API up? | `curl -s $DOMAIN/api/health` — **liveness only**, does not test the database |
| Is the AI configured? | `curl -s $DOMAIN/api/ai/test-key` — expect a boolean, never a key |
| Is auth enforced? | `curl -s -o /dev/null -w '%{http_code}' $DOMAIN/api/advisor/session` → `401` |
| Is the CSRF gate on? | POST with a form content type → expect `403 CSRF_CHECK_FAILED` |
| Are headers applied? | `curl -sI $DOMAIN/ \| grep -iE 'content-security\|strict-transport'` |
| Where are the logs? | Vercel → the deployment → Logs; `vercel logs <url>` |
| Where is the request ID? | In the `500` response body; also on every log line for that request |
| How do I roll back? | Vercel → Deployments → previous → **Promote to Production** |
| Is Sentry on? | Devtools → Network → look for a request to the Sentry ingest host |
| Why is my fix not live? | Service worker cache. Check the stamped version in `dist/sw.js` changed. |

---

**Last verified: 2026-09-26**
