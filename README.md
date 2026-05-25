# Epimetheus

Personality profiling and relationship-intelligence web app. React 19 SPA with a small Express/Vercel API backed by Supabase and Regolo AI.

## Features

- **Personality assessments** — short typed questionnaires that map to one of 8 archetypes (TDI/TJI/TDR/TJR/NDI/NJI/NDR/NJR).
- **AI Oracle calibration** — structured-input analysis that produces traits, indicators, tasks, and tactical guidance, persisted to `oracle_analyses`.
- **AI advisor chat** — streamed SSE conversations with token-aware history truncation and a per-user calibration-aware system prompt.
- **Field reports** — community case studies with comments.
- **Profile management** — display name, bio, social handles, avatar (uploaded via the validating server endpoint).
- **Favorites & dossiers** — personal collections.
- **PWA** — installable, offline-capable shell.

## Tech stack

| Layer | Stack |
|---|---|
| UI | React 19, Vite 6, TypeScript 5.8 (strict), Tailwind 4, Motion, Lenis, Lucide |
| Routing | React Router 7 (`AnimatedRoutes.tsx`, all pages lazy-loaded) |
| State | TanStack Query 5, Zustand 5 (persisted), Context (Auth/Theme/Language) |
| Backend (dev) | Express 5 + helmet (`api/_index.ts`, port 3000) |
| Backend (prod) | Vercel serverless (`api/server.ts`) — same handler module |
| Data | Supabase Postgres + Storage (`user-uploads` bucket) |
| AI | Regolo AI — `Llama-3.3-70B-Instruct` default + 3 fallbacks |
| Tests | Vitest + Testing Library (configured; minimal coverage today) |
| Observability | Sentry (optional via `VITE_SENTRY_DSN`) |

The two backends share the same framework-agnostic handlers in `api/lib/handlers.ts`, so dev and prod can't drift.

## Project layout

```
api/
  _index.ts              Express dev server
  server.ts              Vercel serverless entry
  _config.ts             Regolo client + model fallbacks
  lib/
    auth.ts              JWT validator (getAuthenticatedUser)
    handlers.ts          All shared route handlers
src/
  components/            UI primitives + advisor/calibration/layout subtrees
  contexts/              EnhancedAuth, Theme, Language
  data/                  Static seed data (assessment questions, types)
  hooks/                 useAdvisorChat, useFavorites, route preloading…
  lib/                   supabase, fetch (apiFetch with JWT injection), utils
  pages/                 22 pages — see AnimatedRoutes.tsx
  stores/                Zustand uiStore (persisted)
  utils/                 errorHandling, json, validation, sanitizeHtml…
scripts/
  create-rate-limits-table.sql   [DEPRECATED — see supabase/migrations/]
  rls-audit.sql                  [DEPRECATED — see supabase/migrations/]
public/
  sw.js, manifest.json, icons    PWA assets
supabase/
  migrations/                    Canonical schema (Supabase CLI)
  config.toml                    Supabase CLI config
supabase-schema-v2.sql           [DEPRECATED — see supabase/migrations/]
```

## Routes

All routes require authentication except `/login`, `/register`, and `/reset-password`. `/admin` additionally requires `users.role = 'admin'`. Catch-all redirects to `/`.

```
/login  /register  /reset-password
/  /profile  /assessment  /assessment-result
/calibration  /profiler  /quiz  /compare  /simulation  /decryptor
/advisor  /encyclopedia  /guide  /field-guide  /glossary  /quick-reference
/favorites  /dossiers  /insights  /admin
```

## Database

The canonical schema is in `supabase-schema-v2.sql`. Key tables actually used by the code:

| Table | Purpose |
|---|---|
| `users` | Profile + role (`'user'` or `'admin'`) |
| `assessment_results` | Short-form assessment outputs |
| `calibrations` | Server-validated trait analyses |
| `oracle_analyses` | AI Oracle outputs (server-validated insert) |
| `advisor_sessions`, `advisor_messages` | Chat history |
| `field_reports`, `field_report_comments` | Community feed |
| `feedback` | User feedback (anonymous allowed) |
| `favorites`, `dossiers` | Personal collections |
| `rate_limits` | Vercel rate-limit counter |

RLS is enforced on all of these (see `scripts/rls-audit.sql`). `auth.uid() = user_id` is the standard isolation rule. Admin reads on `users`, `feedback`, and admin deletes on community tables go through an `is_admin()` SECURITY DEFINER helper that avoids the recursion that previously bricked the dashboard.

## Security model

- **Server-derived userId**: every authenticated handler resolves `userId` from the Supabase JWT (`api/lib/auth.ts → getAuthenticatedUser`). Body/query userIds are never trusted.
- **CORS**: explicit allow-list with `Vary: Origin`. Never `*` together with `Allow-Credentials: true`.
- **CSRF**: state-changing requests must send `X-Requested-With: XMLHttpRequest` or `Content-Type: application/json`. `apiFetch` adds these automatically.
- **CSP**: `script-src` excludes `'unsafe-inline'`. `style-src` keeps it for Tailwind 4 inlined critical CSS.
- **Profile uploads**: the `/api/upload/profile-photo` endpoint sniffs magic bytes (PNG/JPEG/GIF/WEBP), enforces a 1MB cap, and writes to `users/<auth.uid()>/...` derived from the JWT. The client posts a base64 data URL — direct storage writes have been removed.
- **AI input validation**: calibration and oracle analyses are shape-validated and length-clamped server-side before insert, so a compromised client can't push arbitrary blobs into JSON columns.
- **Rate limiting**: in-memory bucket per IP for dev; atomic `record_and_count_rate_limit(key, window_seconds)` RPC for Vercel (avoids the SELECT-then-INSERT race). Public endpoints (`/api/security/log`) have their own bucket.
- **Recovery flow**: `/reset-password` handles both the "request email" step and the post-recovery "set new password" step (driven by Supabase `PASSWORD_RECOVERY` event).

## Development

### Prerequisites

- Node 18+
- Supabase project (URL + anon key + service role key)
- Regolo API key (https://regolo.ai)

### Setup

```bash
npm install
cp .env.example .env
# Fill in the required values from .env.example
```

In your Supabase project, run the migrations in `supabase/migrations/` in lexicographic order. The Supabase CLI does this automatically:

```bash
supabase db reset
```

Without the CLI, run each file in the SQL editor in this order:
1. `supabase/migrations/20240101000000_initial_schema.sql`
2. `supabase/migrations/20240101000100_rls_audit.sql`
3. `supabase/migrations/20240101000200_rate_limits.sql`

The legacy SQL files at the repo root (`supabase-schema-v2.sql`) and under `scripts/` (`rls-audit.sql`, `create-rate-limits-table.sql`) are kept on disk for one release cycle but are no longer authoritative. Apply only the migrations.

### Scripts

```bash
npm run dev          # Frontend (5173) + API (3000) concurrently
npm run dev:frontend # Frontend only
npm run dev:api      # API only
npm run build        # Production build
npm run build:analyze
npm run preview
npm run lint         # tsc --noEmit (frontend + api shared config)
npm run lint:api     # tsc --noEmit (api-only config)
npm run test         # vitest run
npm run diagnose     # tsx scripts/diagnostic.ts (env + Supabase smoke test)
```

### Required environment variables

See `.env.example` for the full list. Minimum to boot the app:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
REGOLO_API_KEY=
```

Optional:

- `VITE_SENTRY_DSN` — enables Sentry (no-op without DSN)
- `VITE_RECAPTCHA_SITE_KEY` — reCAPTCHA on auth pages
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — outbound mail
- `ALLOWED_ORIGINS` — comma-separated CORS allow-list (defaults include localhost + epimetheus.ai)

## Deployment

- **Vercel** is the primary target. The `api/` folder maps to serverless functions; `dist/` is the static frontend.
- Set the same environment variables in the Vercel project settings. `SUPABASE_SERVICE_ROLE_KEY` and `REGOLO_API_KEY` must NOT be `VITE_`-prefixed.
- Run all three SQL files in Supabase before the first deploy.

## Known caveats

- **Tests**: Vitest is wired up but coverage is sparse (one util test). New features should ship with coverage.
- **Schema sources of truth**: `supabase/migrations/` is canonical; the legacy files (`supabase-schema-v2.sql`, `scripts/rls-audit.sql`, `scripts/create-rate-limits-table.sql`) are kept for one release cycle and should not be edited.
- **Custom Supabase auth lock**: `src/lib/supabase.ts` uses a no-op lock to dodge a Web Locks API timeout warning under React StrictMode. Single-tab use is fine; multi-tab token refresh can theoretically race. Acceptable for now.
- **Dependency audit**: run `npm audit` periodically. The codebase doesn't pin transitive deps.

## License

Private and proprietary.
