# Deep Analysis — Epimetheus

**Last verified: 2026-09-26** · against commit `37c2505f487fd1d43ab73eb7ec3d909767e7546f` (2026-09-12)

> **This file was rewritten.** The previous version contained at least eight
> errors: "23 routes" (there are 27 page components), Workbox as the PWA layer
> (the service worker is hand-written; Workbox is not a dependency), a
> Llama-3.1-8B fallback model that commit `f358810` had already removed as
> invalid, and "run all three SQL files" where there are nine migrations. Every
> claim below was re-derived from source. Corrections are listed in §9.

---

## 1. What the system is

A personality-profiling and relationship-intelligence coaching app. The user
answers a short typed questionnaire, gets one of eight archetypes
(TDI/TJI/TDR/TJR/NDI/NJI/NDR/NJR), then takes a described scenario through an
"AI Oracle" calibration that produces structured traits, indicators, tasks, and
tactical guidance. A streaming advisor chat provides follow-up coaching against
that context.

Presented by **Yame Coaching** (per `metadata.json`). The audience is coaching
clients, not anonymous consumer traffic.

---

## 2. Verified tech stack

| Layer | Technology | Version in `package.json` |
| --- | --- | --- |
| UI | React | `^19.0.0` |
| Build | Vite | `^6.2.0` |
| Language | TypeScript | `~5.8.3` (strict) |
| Styling | Tailwind + `@tailwindcss/postcss` | `^4.2.2` |
| Routing | `react-router-dom` | `^7.14.1` |
| Server state | `@tanstack/react-query` | `^5.99.0` |
| Client state | `zustand` | `^5.0.12` |
| Animation | `motion` | `^12.38.0` |
| Smooth scroll | `lenis` | `^1.3.18` |
| Charts | `recharts` | `^3.8.0` |
| Icons | `lucide-react` | `^0.546.0` |
| Markdown | `react-markdown` | `^10.1.0` |
| Command palette | `cmdk` | `^1.1.1` |
| Toasts | `sonner` | `^2.0.7` |
| Backend (dev) | `express` + `helmet` | `^5.2.1` / `^8.1.0` |
| Backend (prod) | `@vercel/node` | `^3.2.0` — **declared as a production dependency** |
| Data | `@supabase/supabase-js` | `^2.103.3` |
| Errors | `@sentry/react`, `@sentry/node` | `^10.53.1` |
| Image tooling | `browser-image-compression`, `html-to-image`, `html2canvas` | `^2.0.2` / `^1.11.13` / `^1.4.1` |
| Lists | `react-window` | `^2.2.7` |
| Tests | `vitest` | `^4.1.6` |
| Lint | `eslint` (flat config) | `^9.39.4` |

### Corrections to the previous version

- **Model list.** Previously listed `Llama-3.1-8B` as a fallback. Commit
  `f358810` was titled *"remove invalid Llama-3.1-8B model, treat 504 as
  retriable"*. Read the live chain in `api/_config.ts` rather than trusting a
  document — the fallback list is configuration, and configuration changes.
- **Workbox.** The previous version listed Workbox under PWA. Workbox is **not**
  in `package.json`. `public/sw.js` is a hand-written service worker of 112
  lines whose version string is stamped at build time by
  `scripts/inject-sw-version.mjs`.

---

## 3. Layered architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER                                                        │
│                                                                 │
│  main.tsx (166)                                                 │
│    └─ SessionErrorBoundary                                      │
│         └─ EnhancedAuthProvider (634)  ← Supabase auth +        │
│              │                            users-table sync       │
│              └─ App (51)                                        │
│                   ├─ ErrorBoundary                              │
│                   ├─ QueryClientProvider                        │
│                   ├─ LanguageProvider                           │
│                   ├─ ThemeProvider                              │
│                   ├─ ReactLenis                                 │
│                   └─ AnimatedRoutes (416) ← 27 lazy routes      │
│                        └─ ProtectedRoute → Layout (893) → Page  │
└────────────────────────────┬────────────────────────────────────┘
                             │  /api/*  +  Authorization: Bearer <JWT>
                             │  Content-Type: application/json  (CSRF gate)
┌────────────────────────────▼────────────────────────────────────┐
│  API — ONE handler module, TWO mounts                           │
│                                                                 │
│  api/_index.ts (377)          api/server.ts (376)               │
│  Express 5 · dev · :3000      Vercel serverless · prod          │
│  helmet · CORS · CSRF ·       (Vercel timeout config)           │
│  in-memory rate limit ·                                         │
│  /api/v1/* → /api/*                                             │
│         │                            │                          │
│         └────────────┬───────────────┘                          │
│                      ▼                                          │
│         api/lib/handlers.ts (1392)  ← 16 handlers               │
│                      │                                          │
│      ┌───────────────┼────────────────┐                         │
│      ▼               ▼                ▼                         │
│  lib/auth.ts    lib/tierGate.ts   _config.ts                    │
│  (178) JWT      (234) tiers       (278) Regolo client           │
│  lib/http.ts (138) headers/CORS/CSP                             │
│  lib/log.ts  (212) structured logs + request IDs                │
│  lib/sentryNode.ts (154) optional                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬─────────────┐
        ▼              ▼              ▼             ▼
   Supabase       Supabase        Regolo AI      Sentry
   Postgres       Storage      Llama-3.3-70B   (no-op w/o DSN)
   16 tables      user-uploads
   RLS on
```

### The one decision that matters most

`api/lib/handlers.ts` exports handlers that accept a plain `NormalizedRequest`
and return a plain `NormalizedResponse`. Neither type knows about Express or
Vercel. Each entry point adapts its framework's request into that shape and
calls the same handler.

**Why it matters.** The classic failure mode for this deployment topology —
Express in development, serverless in production — is that the two servers
accumulate different middleware, different validation, and different error
handling, so a bug only appears in production. That drift is structurally
prevented here: there is one implementation of each route and it cannot tell
which server called it.

**The cost.** Adding a route requires editing three files (handler +
`_index.ts` + `server.ts`). Forgetting the second registration is the single most
common way this codebase drifts, and it is the reason `CONTRIBUTING.md` §7 makes
it an explicit checklist step.

**The weakness.** 1392 lines holding every domain is a Single Responsibility
violation. It is hard to review, hard to test in isolation, and every domain's
changes collide in one file's merge conflicts.

---

## 4. Data model

**16 tables**, defined across 9 migrations in `supabase/migrations/`.

```
users ──┬── calibrations
        ├── oracle_analyses          ← free-text scenario input + AI output
        ├── assessment_results
        ├── advisor_sessions ──┬── advisor_messages
        │                      │     (FK: session_id, NOT cascading)
        ├── favorites
        ├── dossiers                 ← THIRD-PARTY personal data
        ├── feedback
        ├── field_reports ──┬── report_likes       (UNIQUE user+report)
        │                   └── field_report_comments
        └── report_likes

standalone: rate_limits · verification_codes · public_config · private_config
```

Full column list with types and constraints: [`docs/architecture/README.md`](./docs/architecture/README.md).

### Sensitive data map

| Table | Sensitivity | Why |
| --- | --- | --- |
| `dossiers` | **Highest** | Contains data about **third parties** who never consented. Names, phases, notes about people who are not users of this app. |
| `advisor_messages` | High | Full conversation text, including whatever the user chose to disclose. |
| `oracle_analyses` | High | Free-text scenario descriptions — often about real relationships. |
| `users` | High | Email, display name, bio, `contact_info` JSONB. |
| `feedback` | Medium | Free text plus `user_agent` and `url`. |
| `verification_codes` | Medium | Email + short-lived numeric code. |
| `field_reports` | Intentional | Public to authenticated users **by design** — this is a community feature. |
| `rate_limits` | Low | Pseudonymous keys only. |

### Privileged columns on `users`

`role`, `subscription_tier`, `subscription_expires_at`.

**These are the crown jewels.** A policy granting blanket `UPDATE` on `users`
would let a user write `role = 'admin'` or grant themselves a paid tier. Row
Level Security alone does not prevent this — RLS decides *which rows* a user may
write, not *which columns*. Column protection requires a trigger or
service-role-only write, which is what the `security_hardening` migration
intends (`lock_privileged_user_columns`) and what the hardening patch produced
during the audit **found to be inert** and fixed.

### RLS: the two failure modes

1. **`UPDATE` policy with `USING` but no `WITH CHECK`.** `USING` filters rows the
   user may touch; `WITH CHECK` filters the rows they may *leave behind*. Without
   `WITH CHECK`, a user can legitimately target their own row and then rewrite
   `user_id` to point at someone else's account.
2. **A policy on `users` that queries `users`.** This recurses — Postgres error
   `42P17` — and takes the whole table offline, which is what previously bricked
   the admin dashboard. The fix is the `SECURITY DEFINER` `is_admin()` helper in
   `20240101000100_rls_audit.sql`, which reads `role` with the definer's
   privileges and therefore does not re-enter the policy.

---

## 5. Authentication and authorisation

### Flow

```
Sign-up / sign-in
  → Supabase Auth (email+password, or Google OAuth)
  → session persisted in localStorage by the Supabase client
  → EnhancedAuthProvider.loadSession()  (up to 3 retries,
                                         8s hard safety timer → loading=false)
  → sync public.users row
  → every /api/* call attaches Authorization: Bearer <access_token>
  → server: getAuthenticatedUser(authHeader, supabaseClient)
      verifies the JWT with Supabase and returns the user
  → handlers use ONLY that server-derived id
```

**The critical invariant: the server never trusts a client-supplied `userId`.**
A `userId` in a request body or query string is ignored. This closes the most
common multi-tenant data-access bug in one line of discipline, and the audit
confirmed the pattern is applied consistently across `api/lib/handlers.ts`.

### Authorisation layers

| Layer | Mechanism | Server-enforced? |
| --- | --- | --- |
| Route access | `ProtectedRoute` in the SPA | No — convenience only |
| Admin pages | `role === 'admin'` check in the SPA | No |
| Admin API | `handleAdminDeleteUser` re-verifies role server-side | **Yes** |
| Tier gating | `api/lib/tierGate.ts` on privileged handlers | **Yes** |
| Row ownership | RLS `auth.uid() = user_id` | **Yes** |
| Privileged columns | Trigger / service-role-only write | **Yes** (see §4 caveat) |

**The rule to internalise:** a check that runs in the browser is not a control,
it is a courtesy. Removing it makes the UI worse, not the system safer. Adding a
feature that is protected only by a client-side gate adds a paywall you can
bypass with devtools.

### Embedded-WebView detection

Google OAuth cannot complete inside an in-app browser (the Instagram/Facebook
webview). The app detects this case and explains it rather than failing with an
opaque error — a small detail that prevents a whole class of "the login button
does nothing" reports.

### Known weakness

Session tokens live in `localStorage`. Any successful XSS therefore escalates to
complete account takeover, with no `HttpOnly` boundary in the way. Moving the
session to cookies is a cross-cutting change to the auth provider, the fetch
wrapper, and the server-side JWT validator — recorded as an accepted risk in
`SECURITY.md`, not fixed.

---

## 6. Security posture

### Controls confirmed present

| Control | Where |
| --- | --- |
| Server-derived identity | `api/lib/auth.ts` `getAuthenticatedUser` |
| CSRF gate — fail-closed | Both entry points; requires `Content-Type: application/json` or `X-Requested-With` |
| CORS allow-list + `Vary: Origin` | `api/lib/http.ts`; never `*` with credentials |
| CSP without `'unsafe-inline'` in `script-src` | `api/lib/http.ts` |
| Upload magic-byte sniffing + size cap + JWT-derived path | `handleUploadProfilePhoto` |
| Server-side payload shape + length validation | Oracle and calibration handlers |
| Atomic DB-backed rate limiter | `record_and_count_rate_limit(rl_key, window_seconds)` |
| Build-time secret-leak guard | `vite.config.ts` — aborts the build |
| No `dangerouslySetInnerHTML` / `eval` / `new Function` | Whole `src/` tree |
| Markdown rendered through `react-markdown` + sanitizer | `src/utils/sanitizeHtml.ts` |
| Structured logs with request IDs, no secret values | `api/lib/log.ts` |
| Optional Sentry on both sides | `src/lib/sentry.ts`, `api/lib/sentryNode.ts` |

### Findings that remain open

Recorded here because a security document that only lists strengths is
marketing. Full detail in [`docs/security/threat-model.md`](./docs/security/threat-model.md);
status in [`CHANGELOG.md`](./CHANGELOG.md).

**Critical, verified against the repository:**

1. **Credentials in git history.** Live keys (Regolo, OpenRouter, Supabase
   service role, a mail app password) were committed in `.env` files across a
   commit window of 2026-04-17 → 2026-05-20. Rotating every one of them is an
   owner action no commit can perform. Purging history requires `git filter-repo`
   plus a GitHub support ticket to clear cached objects.
2. **No security headers on the production document.** `vercel.json` in `main`
   has no `headers` block; the HTML ships without CSP, HSTS, or
   `X-Frame-Options`.
3. **The CSP blocks the app's own inline script.** `index.html` contains an
   inline theme-bootstrap `<script>`; the CSP excludes `'unsafe-inline'`.
   Consequence: in production the theme bootstrap does not run.
4. **20 production dependency advisories** (3 critical across the full tree,
   including `tar` reached through `@vercel/node`, which is declared as a
   *production* dependency while being used for a type-only import).

**High:**

5. No `trust proxy` on the Express path → one shared rate-limit bucket.
6. Account self-deletion could leave a ghost auth row (email still taken,
   sign-in still working).
7. Production rate limiter was **fail-open** on RPC error — a database error
   removed the limit instead of denying.
8. `message?.trim()` threw a `500` on a non-string body.
9. Public storage bucket with deterministic object paths exposed user photos.
10. The column-lock trigger intended to protect `role` / `subscription_tier` was
    **inert**, and a column `REVOKE` was a no-op.
11. Missing `WITH CHECK` on the `users` `UPDATE` policy.

**The pattern worth noticing:** items 3 and 4 are the same failure. A control was
*defined* in one place and the system behaved as if it were in force somewhere
else. That is how a security review ends up confidently wrong — "we have a CSP"
and "the CSP blocks our own script" are both true at once.

### Security debt by design

Documented and deliberate, so they are not re-reported: `localStorage` sessions;
in-process rate limiting in the dev server; Sentry disabled without a DSN;
permissive CORS default origins including two product domains.

---

## 7. Performance posture

Verified build output shape: the production bundle splits vendors into separate
chunks via manual chunking in `vite.config.ts`. The main entry chunk dominates
the bundle; exact byte counts change with every dependency bump, so measure
rather than quote:

```bash
npm run build:analyze
```

### Confirmed bottlenecks

| # | Issue | Where | Mechanism |
| --- | --- | --- | --- |
| 1 | Render-blocking third-party stylesheet | `index.html` — `fonts.googleapis.com` | 18 font faces behind a blocking cross-origin request with no `preconnect`: DNS + TLS before first paint |
| 2 | Non-passive scroll listener calling `setState` per event | `Layout.tsx` | Fires on every scroll frame; combined with Lenis's own scrolling this is continuous main-thread work |
| 3 | `AnimatePresence mode="wait"` on route transitions | `AnimatedRoutes.tsx` | Forces the outgoing page's exit animation to finish before the incoming page mounts — serialised navigation |
| 4 | Durable rate limiter defined but unused | `api/_index.ts` | Uses an unbounded in-memory `Map` instead of the existing DB RPC; grows without limit and resets on restart |
| 5 | No response compression | `api/_index.ts` | No `compression()` middleware, so JSON API responses go out uncompressed |

### Structural inefficiencies

- **`select('*')` on hot queries.** Over-fetching columns on the user, field
  report, dossier, and favorite queries. Worst case: pulling full JSON result
  blobs when only a summary field is rendered.
- **Advisor pagination ordered oldest-first with a `limit`.** The query returns
  the *oldest* N rows and silently discards everything after row N, so a long
  session eventually shows stale history and drops the newest turns — including
  from the model's context.
- **Zero `React.memo`.** Every re-render of a list container re-renders all
  children, including the chart components, which are the expensive ones.
- **Per-request auth token fetch.** Each `/api/*` call calls
  `supabase.auth.getSession()` before fetching, adding a round trip inside the
  round trip.
- **Redundant dynamic import of Sentry.** Repeated `await import('@sentry/react')`
  re-resolves a module that is already in memory.
- **Excessive `backdrop-blur`.** Blur on layers that are ≥90% opaque: the blur
  is invisible but the GPU still composites the full viewport.

Measured magnitudes are only meaningful against a specific baseline — the
optimisation patch produced during the audit measured its own before/after and
did **not** run Lighthouse (no Chrome binary was available in that environment),
so its paint-path figures are estimates from code changes, not traces. Treat any
performance claim in this repository's history as directional until someone runs
Lighthouse with a real browser.

---

## 8. Quality posture

| Dimension | State |
| --- | --- |
| TypeScript | Compiles clean under `strict`. Two separate projects (`src/`, `api/`). |
| ESLint | Flat config, ESLint 9. Reports warnings, notably `no-explicit-any`. |
| Tests | **5 files.** `api/lib/handlers.test.ts` (595), `api/lib/auth.test.ts` (175), `src/utils/validation.test.ts` (213), `src/utils/sanitizeHtml.test.ts` (102), `src/utils/json.test.ts` (35). |
| Component tests | **Zero**, against 27 pages and 50+ components. |
| Hook tests | **Zero**, against 11 hooks — including a 435-line streaming hook. |
| Coverage tooling | None. No threshold enforced. |
| Tests type-checked? | **No** — excluded from `tsc --noEmit`, so a type error in a test passes CI. |
| CI | **None.** No `.github/workflows/`. Nothing gates a merge. |
| Documentation | Previously 10 files / 2269 lines ≈ 7.1% of source LOC, with 27 verified drifts. Now far higher. |
| Formatting | No Prettier, no `.editorconfig`. Quote style and import order are inconsistent. |
| `any` usage | Present in both trees; it disables downstream checking wherever it appears. Count it, do not quote a number. |

### Complexity hotspots

| File | Lines | Problem |
| --- | --- | --- |
| `api/lib/handlers.ts` | 1392 | Every domain in one module |
| `src/pages/CalibrationPage.tsx` | 1933 | 21 `useState`, 4 `useEffect` |
| `src/pages/PricingPage.tsx` | 940 | |
| `src/pages/AdminDashboard.tsx` | 905 | Admin surface; highest consequence if wrong |
| `src/components/layout/Layout.tsx` | 893 | Nav, drawer, footer, scroll handling |
| `src/data/personalityTypes.ts` | 1386 | Static content in TypeScript |
| `handleAdvisorChatStream` | ~202 | Streaming, persistence, and prompt assembly in one function |
| `handleAiChat` | ~146 | Same, non-streaming |

**The riskiest combination in the repository** is `CalibrationPage.tsx`: the
most-used page, the largest file, 21 pieces of state, and no component tests. Any
refactor there is a high-consequence bet, which is exactly why the correct first
step is tests, not extraction.

### Duplication

- `createClient` from `@supabase/supabase-js` is instantiated in three places.
- Service-role key validation is duplicated across files.
- Two canvas libraries (`html2canvas`, `html-to-image`) with different call
  sites; both are used.
- Legacy SQL files duplicate schema already owned by `supabase/migrations/`.

---

## 9. Corrections to the previous version of this file

| Previously stated | Reality | Evidence |
| --- | --- | --- |
| 23 routes | 27 page components | `ls src/pages/*.tsx` |
| Workbox (PWA) | Hand-written `public/sw.js`, 112 lines; Workbox not a dependency | `package.json`, `public/sw.js` |
| `Llama-3.1-8B` fallback | Removed as invalid | commit `f358810` |
| "Run all three SQL files" | There are **9** migrations in lexicographic order | `supabase/migrations/` |
| Schema source implied at root | `supabase/migrations/` is canonical; root file is legacy | `supabase/migrations/` |
| No date on the document | Every document now carries `Last verified: 2026-09-26` | this file |
| Endpoint list incomplete | 16 handlers documented in README §9 | `api/lib/handlers.ts` |
| `src/components/Layout.tsx` (in sibling docs) | `src/components/layout/Layout.tsx` | filesystem |

Two things the previous version asserted that remain **unresolved**, and which
this rewrite marks rather than invents:

- **The Supabase client instantiated in three places** was reported by the
  code-quality audit. Consolidating it requires deciding whether the server
  should hold one client per request or one per process — a real design
  question, not a mechanical fix. Left open.
- **`errorHandling.ts` contains an interface that resembles a
  Firebase-era leftover.** Whether it is genuinely unused is a matter for a
  dead-code pass with a bundler, not a read. Left open.

---

**Last verified: 2026-09-26**
