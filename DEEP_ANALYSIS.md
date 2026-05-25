# Deep Analysis — Epimetheus

Snapshot of the architecture and security posture as of the most recent hardening pass.

## Tech stack

- React 19, Vite 6, TypeScript 5.8 (strict), Tailwind 4
- React Router 7, Motion 12, Lenis (smooth scroll)
- TanStack Query 5, Zustand 5, React Context (Auth/Theme/Language)
- Supabase Postgres + Storage
- Regolo AI (`Llama-3.3-70B-Instruct` default, with Llama 3.1 8B / gemma4-31b / mistral-small3.2 fallbacks)
- Express 5 for the dev API; Vercel serverless for prod (shared handler module)
- Sentry (optional), Workbox (PWA)

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
                 └─ AnimatedRoutes      ← 23 routes, all lazy()
                      └─ ProtectedRoute → Layout → PageWrapper(motion)

api/lib/handlers.ts  (framework-agnostic)
   ├─ used by  api/_index.ts   (Express dev)
   └─ used by  api/server.ts   (Vercel serverless)
```

The shared handler module is the most important architectural choice: dev and prod use the same business logic, which prevents drift.

## Routing

23 lazy-loaded routes. Public: `/login`, `/register`, `/reset-password`. Admin-gated: `/admin`. Everything else requires auth. Catch-all redirects to `/`.

## Authentication

Supabase email/password and Google OAuth (with embedded-WebView detection). Sessions persist via localStorage with auto-refresh. The auth provider runs `loadSession` with up to 3 retries and an 8-second hard safety timer that forces `loading=false` so the app can never get stuck on the loading screen.

A SECURITY DEFINER `is_admin()` helper reads `users.role = 'admin'` without triggering RLS recursion on the `users` table. Admin policies on `users`, `feedback`, and community tables consult this helper.

## Server endpoints

All under `/api/` (also reachable via `/api/v1/`):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Status + flags |
| GET | `/api/ai/test-key` | public | Reports whether `REGOLO_API_KEY` is set |
| POST | `/api/security/log` | public (rate-limited) | Best-effort security event logging |
| POST | `/api/upload/profile-photo` | required | Magic-byte sniffed, 1MB cap, JWT-derived path |
| POST | `/api/advisor/session` | required | Create chat session |
| GET | `/api/advisor/session` | required | Latest session + last 50 messages |
| DELETE | `/api/advisor/session/:id` | required | Owner-only delete |
| POST | `/api/advisor/chat` | required | SSE streaming with token-aware history truncation |
| POST | `/api/calibration/analyze` | required | Server-validated trait analysis |
| POST | `/api/oracle/analyses` | required | Server-validated Oracle insert (replaces direct client write) |
| POST | `/api/ai/chat` | required | Generic Regolo proxy (validated, image-aware) |

`getAuthenticatedUser` resolves the Supabase JWT on every request and supplies `req.user` to handlers. Handlers always use `req.user.id`, never a body/query userId.

## AI integration

- Provider: Regolo AI, `https://api.regolo.ai/v1/chat/completions`
- Streaming: handler returns an `AsyncIterable<string>` of SSE chunks; both Express and Vercel iterate and flush. The client (`useAdvisorChat`) parses both `\n\n` and `\r\n\r\n` boundaries, sanitizes each chunk via `sanitizeAiResponse`, and supports abort.
- Persistence: user message is saved before streaming starts; assistant reply is saved after the stream completes. Stream interruptions never lose the user's prompt.
- Truncation: history is trimmed when total content exceeds ~5k tokens worth of chars, leaving headroom for the system prompt and a 600-token reply inside Llama 3.3 70B's 8192-token context.
- Fallback: per-model retry chain in `createCompletion`. 429s honor `Retry-After`; 401/402/403 short-circuit.

## Data layer

Canonical schema lives in `supabase-schema-v2.sql`. Active tables:

- `users`, `assessment_results`, `calibrations`, `oracle_analyses`
- `advisor_sessions`, `advisor_messages`
- `field_reports`, `field_report_comments`, `feedback`
- `favorites`, `dossiers`
- `rate_limits` (Vercel-only)
- `verification_codes`, `public_config`, `private_config`

RLS policies for all user-data tables are in `scripts/rls-audit.sql`. Storage policies restrict `user-uploads` writes to `users/<auth.uid()>/…`. The `feedback` table allows anonymous (`user_id IS NULL`) inserts; reads are owner or admin only.

## Security posture

Hardened in this pass:

1. **RLS coverage** — `field_reports`, `field_report_comments`, `feedback` all have owner-scoped policies plus admin overrides. An atomic `increment_field_report_comments(uuid)` RPC replaces the racy client-side comment-count update.
2. **Server-validated `oracle_analyses` writes** — the client previously wrote the AI JSON blob directly. Now it goes through `POST /api/oracle/analyses` which whitelists type codes, clamps every string, validates task enums, and caps array lengths.
3. **Profile photo uploads through the API** — `EditProfileModal` no longer writes directly to storage. The endpoint sniffs magic bytes, enforces a 1MB cap, and derives the user folder from the JWT.
4. **Atomic Vercel rate limiter** — `record_and_count_rate_limit(key, window_seconds)` RPC inserts and counts in a single statement, eliminating the SELECT-then-INSERT race that let bursts slip past the limit.
5. **`/api/security/log` is rate-limited** — separate bucket per IP (30/min in dev, same on Vercel) so the public endpoint can't be flooded.
6. **`/reset-password` route exists** — handles both the request-email step and the post-recovery set-new-password step. The faulty `origin + path || fallback` redirect logic in the auth context was fixed.
7. **`is_admin()` SECURITY DEFINER helper** — recursion-safe admin check used by RLS policies.

Pre-existing strengths kept:

- JWT-derived `userId` everywhere on the server
- Explicit CORS allow-list with `Vary: Origin`, never `*` + credentials
- `X-Requested-With` / JSON content-type CSRF check
- CSP without `unsafe-inline` on `script-src` (still required for `style-src` because Tailwind 4 inlines critical CSS)
- HSTS in production
- Server-side calibration validation with length clamps

Remaining trade-offs:

- The custom Supabase auth `lock` is a no-op — fine for single-tab SPA use, theoretically races on multi-tab token refresh. Not fixed.
- Tailwind 4 still requires `style-src 'unsafe-inline'`. Move to nonce-based styling later.

## Code-quality cleanups in this pass

- **`cn()` consolidation** — six local copies in `CalibrationPage`, `EncyclopediaPage`, `FieldGuidePage`, `GuidePage`, `Logo`, `CommandCenter` were replaced with `import { cn } from '@/lib/utils'`. Single source of truth.
- **`sanitizeInput` / `isValidEmail` consolidation** — `validation.ts` is canonical; `errorHandling.ts` re-exports from it so existing import paths keep working.
- **`README.md` and this file** — rewritten to match what the code actually does. The old docs claimed Gemini/GPT-4/Claude as AI providers, listed nonexistent files (`services/regolo.ts`, `auth/send-code.js`, `ai/models.js`), and described a 16-table schema with names that don't exist.

## What still warrants attention

- **Test coverage** — Vitest is configured but only `src/utils/json.test.ts` exists. New work should ship with coverage.
- **Large components** — `Layout.tsx` (~830 lines) and `CalibrationPage.tsx` (~1600 lines) still warrant splitting for HMR speed and readability.
- **Streaming UI updates** — `useAdvisorChat.performSend` does `setMessages(prev => prev.map(...))` per token. Switch to ref + `flushSync` + RAF batching for long replies.
- **`AdminDashboard`** — three unbounded `select('*')` calls in parallel. Add pagination + projections.
- **`oracle_analyses` task toggles** — still round-trip per click via JSON-path update. Debounce or batch.
- **`Layout.tsx`** — references Firebase error codes (`auth/popup-closed-by-user`) that Supabase never emits. Dead defensive code.
- **`npm audit`** — re-run periodically.
- **Schema sources of truth** — `supabase-schema-v2.sql` and `scripts/rls-audit.sql` need to be kept in sync manually. Worth migrating to a `supabase/migrations/` folder long term.
