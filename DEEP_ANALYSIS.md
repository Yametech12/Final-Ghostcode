# Deep Analysis — Epimetheus

Verified snapshot of the architecture and security posture as of **2026-09-27**.
Every claim in this document was checked against the current code; verification
commands and results are logged at the bottom.

## Tech stack

- React 19, Vite 6, TypeScript 5.8 (strict), Tailwind 4
- React Router 7, Motion 12, Lenis (smooth scroll)
- TanStack Query 5, Zustand 5, React Context (Auth/Theme/Language)
- Supabase Postgres + Storage
- Regolo AI (`Llama-3.3-70B-Instruct` default, with `gemma4-31b` / `mistral-small3.2` fallbacks; `Llama-3.1-8B` was removed as invalid on Regolo)
- Express 5 for the dev API (`api/_index.ts`); Vercel serverless (`api/server.ts`) for prod — both delegate to the shared handler module
- Sentry (optional, client + server DSNs), hand-rolled PWA service worker (not Workbox)

## Architecture

```
main.tsx
  └─ SessionErrorBoundary
       └─ EnhancedAuthProvider          ← Supabase auth + users-table sync
            └─ App
                 ├─ ErrorBoundary
                 ├─ QueryClientProvider
                 ├─ LanguageProvider
                 ├─ ThemeProvider
                 ├─ ReactLenis
                 └─ AnimatedRoutes      ← 27 routes, all lazy()
                      └─ ProtectedRoute → Layout → PageWrapper(motion)

api/lib/handlers.ts  (framework-agnostic)
   ├─ used by  api/_index.ts   (Express dev)
   └─ used by  api/server.ts   (Vercel serverless)
```

The shared handler module is the most important architectural choice: dev and
prod use the same business logic, which prevents drift.

`main.tsx` also installs a filtered `unhandledrejection` handler (AbortError /
ResizeObserver noise suppressed, everything else surfaces) and a service-worker
update flow that prompts the user with a Refresh action when a new SW is
waiting (`SKIP_WAITING` + reload on `controllerchange`).

## Routing

27 lazy-loaded routes plus a catch-all redirect to `/`.

- **Public:** `/login`, `/register`, `/reset-password` (deliberately not
  `PublicRoute`-wrapped so the PASSWORD_RECOVERY flow works), `/terms`,
  `/privacy`, `/welcome` (landing), `/pricing`.
- **Authenticated:** everything else. `/admin` additionally requires
  `users.role = 'admin'`.
- **Tier-gated (client):** `/advisor`, `/decryptor`, `/simulation`,
  `/calibration` etc. carry `requireTier` on `ProtectedRoute` with per-feature
  paywall copy; locked users get `PaywallScreen` instead of the page.
- `/` is a root splitter: signed-out visitors see the landing page, signed-in
  users see the `HomePage` dashboard under `Layout`.

## Authentication

Supabase email/password and Google OAuth (with embedded-WebView detection).
Sessions persist via localStorage (`epimetheus-auth-token`) with auto-refresh.
The auth provider runs `loadSession` with up to 2 retries (exponential
backoff) and an 8-second hard safety timer that forces `loading=false`, so the
app can never get stuck on the loading screen.

Notable hardening in `EnhancedAuthContext`:

- `loadUserData` is deduplicated two ways: an in-flight Promise map (concurrent
  callers share one fetch) and a 30-second freshness window (skips redundant
  SELECTs). This fixed a bug where a single sign-in fired 20+ identical
  `users` SELECTs.
- Tab-visibility refresh: when a tab hidden for ≥30s becomes visible, userData
  (including tier) is force-refetched so a Stripe webhook tier change made
  elsewhere shows up within one focus.
- Email sync from auth → `users.email` is an upsert that only fires when the
  cached email differs.
- `signOutAndWait` exists for destructive flows (account deletion) that need
  auth state fully settled before navigating.

`src/lib/supabase.ts` wraps the client with a per-name async mutex
(`namedLock`) serializing token refreshes across tabs and StrictMode
double-invokes. Note: its cleanup path is best-effort (the reference-equality
check across `then` chains is unreliable), but a bounded sweep at >32 entries
keeps the Map from growing unboundedly.

A SECURITY DEFINER `is_admin()` helper (search_path pinned, EXECUTE revoked
from PUBLIC) reads `users.role = 'admin'` without RLS recursion; admin RLS
policies consult it.

## Server endpoints

All under `/api/` (also reachable via `/api/v1/`). Auth column reflects the
code, not older docs:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | public | Status + `regolo` key flag |
| GET | `/api/ai/test-key` | public | Whether `REGOLO_API_KEY` is set |
| GET | `/api/ai/credits` | dev only | Always 404 (no Regolo equivalent) |
| POST | `/api/security/log` | **required** (SEC-10) | 30/min/IP bucket; server-derived userId; body `ip` dropped; email redacted |
| POST | `/api/upload/profile-photo` | required | Magic-byte sniff (PNG/JPEG/GIF/WEBP), 1MB cap, stable `users/<uid>/profile.<ext>` with upsert + legacy-file cleanup |
| POST | `/api/advisor/session` | required + strategist | Create chat session |
| GET | `/api/advisor/session` | required + strategist | Latest session + last 50 messages |
| DELETE | `/api/advisor/session/:id` | required | No tier gate by design (downgraded users can still delete) |
| PATCH | `/api/advisor/messages/:messageId/reaction` | required + strategist | like/dislike/null, owner-checked |
| POST | `/api/advisor/chat` | required + strategist | SSE stream, 600/1200 token replies (strategist/oracle), daily budget check |
| POST | `/api/oracle/analyses` | required + strategist | Server-validated/clamped Oracle insert |
| PATCH | `/api/oracle/analyses/:id/tasks` | required (owner) | Validated task replacement |
| DELETE | `/api/oracle/analyses/:id` | required (owner) | |
| POST | `/api/ai/chat` | required + strategist | Generic Regolo proxy; images additionally require oracle; model allow-list; max_tokens ceiling 4096; 55s upstream timeout |
| DELETE | `/api/users/me` | required | 3/min/IP bucket; body `{ confirm: <email> }`; cascades public.users → children → storage |
| DELETE | `/api/admin/users/:id` | required + admin role | Drives deletion through `auth.admin.deleteUser` so the FK cascade fires; self-deletion refused |

`getAuthenticatedUser` (`api/lib/auth.ts`) resolves the Supabase JWT on every
request; handlers always use `req.user.id`, never a body/query userId.

### In-process caches on the server (current, and load-bearing)

- **JWT cache** (`auth.ts`): positive 60s / negative 5s TTL, LRU-capped at
  10k entries, keyed by SHA-256(token), and clamped to the JWT's own `exp`
  claim. Cuts a 30–150ms Supabase round-trip off every authenticated request,
  including time-to-first-token on the streaming chat path. Tradeoff: admin
  force-signout takes up to 60s to propagate.
- **Tier cache** (`tierGate.ts`): 30s TTL, LRU-capped at 5k entries, also
  clamped to the subscription's own `subscription_expires_at`. A cold gated
  request can additionally self-heal a missing `users` row via upsert
  (`ignoreDuplicates`), so a brand-new account's first gated call doesn't 402
  on a missing FK row.
- **Rate limiter** (Vercel path): atomic `record_and_count_rate_limit` RPC,
  **fails closed** with `503 RATE_LIMITER_UNAVAILABLE` on RPC error (SEC-08).
  Buckets: AI/advisor/oracle 15/min/IP, log 30/min/IP, account-delete 3/min/IP.

### AI spend controls

1. Per-IP rate limit (above).
2. Server-side tier gate (`requireTier`) — the client route guard is not
   trusted; a free user curling with a valid JWT gets 402.
3. Per-user **daily token ledger** (SEC-14): `consume_ai_tokens` RPC reserves
   estimated tokens atomically (PK `user_id, day`); exhaustion → `429
   DAILY_BUDGET_EXCEEDED`. Caps: strategist 120k/day, oracle 400k/day
   (estimated tokens, ~4 chars/token +10%, images flat 1200). Ledger *errors*
   fail open (`ledgerError: true`) — availability beats a hard outage of one
   table, and the per-minute limiter still bounds abuse.
4. Model allow-list + `max_tokens ≤ 4096` (SEC-09).
5. Prompt sanitization (SEC-12): `sanitizePrompt.ts` strips control/zero-width/
   bidi chars and neutralizes `system:`/`assistant:` role-spoof lines before
   persistence and dispatch, on both advisor chat and the generic AI proxy.

### Advisor stream robustness (`handleAdvisorChatStream`)

- Client disconnect flips a cancel token wired to the HTTP layer's `close`
  event; the generator stops reading (and billing) Regolo tokens.
- Inactivity guard (30s without a chunk), max 500 chunks, and a 1MB
  buffer-overflow cap defensively bound the stream parse loop.
- Persistence is crash-tolerant: the user message is saved before streaming;
  the assistant reply (even partial) is saved in `finally`. A cancel before
  the first token persists a `[interrupted before reply]` placeholder so the
  conversation shape stays balanced for future turns.

## Data layer

Canonical schema: `supabase/migrations/` — 11 migrations applied in
lexicographic order. `supabase-schema-v2.sql` and the `scripts/*.sql` files
are explicitly non-authoritative (and demonstrably stale: they predate
`ai_token_usage`).

Active tables: `users`, `assessment_results`, `calibrations`,
`oracle_analyses`, `advisor_sessions`, `advisor_messages`, `field_reports`,
`field_report_comments`, `report_likes`, `feedback`, `favorites`, `dossiers`,
`rate_limits`, `ai_token_usage`, `verification_codes`, `public_config`,
`private_config`.

Key integrity machinery:

- `public.users.id → auth.users(id) ON DELETE CASCADE` (migration 00700) —
  the linchpin for both deletion flows.
- `lock_privileged_user_columns` BEFORE UPDATE trigger (00400): non-admin,
  non-service-role callers cannot change `users.role` or
  `users.subscription_tier`. It reads `request.jwt.claims` (JSON) *and*
  falls back to `current_user`/`session_user`, fixing an earlier version that
  broke service-role writes because `request.jwt.claim.role` is NULL on
  modern Supabase Postgres. (BYPASSRLS skips policies, not triggers.)
- `feedback` abuse mitigations: `NOT VALID` CHECK constraints cap message/url/
  UA/email lengths; anonymous inserts allowed, reads are owner-or-admin only.
- `rate_limits` cleanup trigger samples ~1% of inserts to prune old rows.
- Storage: `user-uploads` writes restricted to `users/<auth.uid()>/…`; an
  AFTER DELETE trigger purges a user's storage objects when their row goes.

## Security posture (verified in code)

All 15 SEC patches from the last pass are present and wired:

- SEC-08 fail-closed rate limiter: confirmed in `api/server.ts` (503 on RPC
  error, `rate_limit_rpc_failed_blocking` log).
- SEC-09: `ALLOWED_CLIENT_MODELS` + `MAX_TOKENS_CEILING` confirmed in
  `handleAiChat`.
- SEC-10: `handleSecurityLog` returns 401 without a JWT; CSRF exemption for
  the path removed in both servers.
- SEC-12/14: both AI paths sanitize + budget-check before dispatch.
- SEC-11: `.gitleaks.toml`, nightly full-history CI scan, optional pre-commit
  hook (`git config core.hooksPath scripts/hooks`).
- SEC-13: `vite.config.ts` bakes `__SENTRY_RELEASE__` from
  `SENTRY_RELEASE || VERCEL_GIT_COMMIT_SHA || GITHUB_SHA`, builds with
  `sourcemap: 'hidden'`, and `scripts/upload-sourcemaps.mjs` uploads then
  deletes maps when Sentry credentials are present.
- **Bonus guard:** `assertNoLeakedSecrets` in `vite.config.ts` fails the build
  if any `VITE_REGOLO_API_KEY` / `VITE_STRIPE_SECRET*` / `VITE_SUPABASE_SERVICE*`
  / `VITE_GMAIL_*` / `VITE_SENTRY_AUTH_TOKEN` variable is ever re-introduced.

Pre-existing strengths kept: JWT-derived userId everywhere, explicit CORS
allow-list with `Vary: Origin`, CSRF header check enforced for all
state-changing routes, CSP without `unsafe-inline` on `script-src`, HSTS in
production.

## Findings from this pass

1. **`handleCalibrationAnalyze` was dead code — removed.** It was exported
   from `api/lib/handlers.ts`, covered by tests, and referenced in the
   tierGate docs, but never mounted in `api/_index.ts` or `api/server.ts`,
   and no client code called `/api/calibration/analyze`. Deleted in this
   pass along with its tests; the tier-gate test suite now exercises
   `handleCreateAdvisorSession` instead. The `calibrations` table remains
   live — it is written directly by the client (ProfilerPage) and read by
   Profile/Insights pages and `buildAdvisorMessages`.
2. **Self-serve deletion ordering has a resurrect window.**
   `handleDeleteMyAccount` deletes `public.users` first, then
   `auth.admin.deleteUser`. If the second step fails, the auth row survives
   and `EnhancedAuthContext` will happily re-create the public row on next
   sign-in — an account resurrected with empty data. The handler logs
   `account_delete_auth_step_orphan` for manual cleanup; a retry of the auth
   delete (or a tombstone check) would close the gap. Ghosting in the reverse
   direction is already solved by the auth→public FK.
3. **Cold gated requests double-read `users`.** `requireTier` then
   `getEffectiveTier` can both miss the tier cache on the same request (the
   second call doesn't see the entry the first just cached when the first had
   to upsert). One extra query per cold request per user; harmless at this
   scale, easy to unify if it ever shows up in profiles.
4. **`[interrupted before reply]` placeholders become model turns.** The
   early-cancel placeholder is persisted as `role: 'model'`, so the next
   prompt's history contains it verbatim. Minor prompt-hygiene nit; filter it
   in `buildAdvisorMessages` if it ever skews replies.
5. **Two self-heal paths for the `users` row.** The client
   (`EnhancedAuthContext.loadUserData`) inserts a bare row, and the server
   (`requireTier`) upserts one. Both are idempotent and RLS-bound to
   `auth.uid() = id`, so they compose fine — just duplicated logic.
6. **Legacy SQL files are stale by design.** `supabase-schema-v2.sql` and
   `scripts/*.sql` predate `ai_token_usage` and the 00900 hardening. They are
   documented as non-authoritative; keep them for the promised one-release
   cycle, then delete.

## What still warrants attention

- **Large components:** `CalibrationPage.tsx` (~1,930 lines) and
  `Layout.tsx` (~890 lines) remain the two files most worth splitting for
  HMR speed and readability. (Previously-flagged items that are now *done*:
  AdminDashboard is paginated with column projections; `useAdvisorChat`
  flushes per animation frame instead of per token; the Firebase error-code
  dead code in Layout is gone.)
- **`oracle_analyses` task toggles** still round-trip per click via the JSON
  path PATCH. Debounce or batch.
- **`npm audit`** — prod tree was 0-vulnerability at the last pass; re-run
  periodically. `npm install` still needs `--legacy-peer-deps` (npm arborist
  crash on jsdom's optional `canvas` peer).
- **Stripe** is wired as env-var scaffolding only (`.env.example` price IDs,
  pricing page shows a "not live yet" state). Checkout is Phase-2 work.
- **Test coverage** is respectable for utils/API (110 tests) but pages and
  hooks have none; new features should keep shipping with tests.

## Verification log (2026-09-27)

| Check | Command | Result |
|---|---|---|
| Frontend + shared TS | `npm run lint` (`tsc --noEmit`) | ✅ clean |
| API TS | `npm run lint:api` (`tsc --noEmit --project tsconfig.api.json`) | ✅ clean |
| Tests | `npm test` | ✅ 5 files, **110/110 passing** (`api/lib/auth.test.ts`, `api/lib/handlers.test.ts`, `src/utils/{json,validation,sanitizeHtml}.test.ts`) |
| Route count | grep `path=` in `AnimatedRoutes.tsx` | 27 routes + catch-all |
| Handler wiring | grep in `api/_index.ts` / `api/server.ts` | 15 routes mounted; every exported handler reachable (the never-mounted `handleCalibrationAnalyze` was removed) |
| Migration count | `ls supabase/migrations` | 11 files |
| Secret hygiene | `git log --all --diff-filter=A -- '.env*'` (SEC-01 baseline) | only `.env.example` ever committed |

Environment note: verification ran with `npm install --legacy-peer-deps`
(see TODO.md for the arborist crash rationale). No Supabase/Regolo env vars
were present, so checks were static + unit-level; live smoke testing still
requires a configured dev environment.
