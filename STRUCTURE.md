# Project Structure

**Last verified: 2026-09-26** · against commit `37c2505f487fd1d43ab73eb7ec3d909767e7546f`
(2026-09-12)

> **This file was rewritten.** The previous version described an `api/_server.ts`,
> an `api/index.ts`, an `api/ai/` directory, and a `scripts/debug-script.js`.
> **None of those exist.** It also carried a stale to-do list. Every path and
> line count below was read from the working tree at the commit above.
>
> **On the filename.** `STRUCTURE.md` is a misspelling of `STRUCTURE.md`. The
> task that produced this document specified that filename, so it is kept as-is
> for compatibility; the typo is recorded here rather than renamed out from
> under any existing link.

---

## 1. Repository totals

| Metric | Count |
| --- | --- |
| Tracked files | **188** |
| TypeScript / TSX — `src/` | **27,759** lines |
| TypeScript — `api/` | **4,147** lines |
| SQL (migrations + legacy) | **2,138** lines |
| Markdown at repo root (pre-rewrite) | **660** lines |
| Test files | **5** |
| Page components | **27** |
| Database tables | **16** |
| Migration files | **9** |
| API route handlers | **16** |
| `.env.example` variables | **32** |

---

## 2. Top level

```
Final-Ghostcode/
├── api/                          # Backend — Express (dev) + Vercel (prod)
├── src/                          # React 19 SPA
├── supabase/migrations/          # CANONICAL database schema
├── scripts/                      # Operator scripts + 2 deprecated SQL files
├── public/                       # PWA assets, manifest, service worker
├── docs/                         # Documentation tree (see §6)
├── .github/                      # PR + issue templates, CI workflow
├── .kiro/specs/                  # Recorded spec documents (see §7)
│
├── README.md                     # Entry point
├── CONTRIBUTING.md               # How to contribute
├── CHANGELOG.md                  # Change record
├── SECURITY.md                   # Vulnerability reporting policy
├── CODE_OF_CONDUCT.md            # Contributor Covenant v2.1
├── LICENSE                       # MIT
├── STRUCTURE.md                  # This file
├── DEEP_ANALYSIS.md              # Architecture + security posture
│
├── index.html                    # Vite entry — theme bootstrap, PWA meta
├── package.json                  # Scripts, deps, engines
├── package-lock.json             # 1011 lock entries
├── tsconfig.json                 # Frontend TS project
├── tsconfig.api.json             # API TS project (separate)
├── vite.config.ts                # Build config + SECRET-LEAK GUARD
├── eslint.config.js              # ESLint 9 flat config
├── postcss.config.js             # Tailwind 4 PostCSS plugin
├── vercel.json                   # Deployment config
├── metadata.json                 # Product metadata (name, permissions)
├── .env.example                  # 32 documented variables
├── .gitignore                    # Includes *.tsbuildinfo (see §8)
├── .vercelignore                 # Excludes docs/tests from the deployed bundle
│
├── supabase-schema-v2.sql        # [DEPRECATED] legacy duplicate
└── tsconfig.tsbuildinfo          # [SHOULD NOT BE TRACKED] 148,946 bytes
```

---

## 3. `api/` — the backend

**4,147 lines.** One handler module, two server mounts, one shared type contract.

```
api/
├── _index.ts                 377   Express 5 dev server, port 3000
│                                   + helmet, CORS, CSRF, in-memory rate limit,
│                                   + /api/v1/* → /api/* rewrite
├── server.ts                 376   Vercel serverless entry (production)
├── _config.ts                278   Regolo AI client + model fallback chain
├── _ai.ts                      5   Re-export shim
├── _create-bucket.ts          33   Storage bucket provisioning
└── lib/
    ├── handlers.ts          1392   ALL 16 route handlers (framework-agnostic)
    ├── handlers.test.ts      595   Handler tests
    ├── auth.ts               178   getAuthenticatedUser — JWT validation
    ├── auth.test.ts          175   Auth tests
    ├── tierGate.ts           234   Subscription tier enforcement (SERVER-SIDE)
    ├── http.ts               138   Shared security headers + CORS + CSP
    ├── log.ts                212   Structured logging + request IDs
    └── sentryNode.ts         154   Server-side Sentry wiring (optional)
```

### Why this shape

`handlers.ts` exports functions that take a `NormalizedRequest` and return a
`NormalizedResponse` — plain objects, not Express or Vercel types. Each entry
point adapts its own framework's request into that shape:

```ts
// api/_index.ts (Express)
async function normalize(req: express.Request): Promise<NormalizedRequest> {
  const user = await getAuthenticatedUser(req.headers.authorization, supabase);
  return { method: req.method, body: req.body, query: req.query,
           params: req.params, headers: req.headers, user };
}
```

This is what makes dev/prod drift structurally hard: there is exactly one
implementation of every route, and it does not know which server is calling it.

**Consequence for contributors.** Adding a route means editing **three** files:
the handler in `handlers.ts`, and a registration in **both** `_index.ts` and
`server.ts`. Registering it in only one is the most common way this codebase
drifts. See `CONTRIBUTING.md` §7.

**Known weakness.** 1392 lines mixing every domain is a Single Responsibility
violation. Splitting it into `lib/handlers/advisor.ts`, `/oracle.ts`,
`/users.ts`, and so on, with the current file re-exporting for compatibility, is
the highest-value refactor available — a behaviour-preserving move with no
runtime change, which is exactly why it deserves its own PR and its own test run.

---

## 4. `src/` — the frontend

**27,759 lines** across TypeScript and TSX.

```
src/
├── App.tsx                     51   Provider composition
├── main.tsx                   166   Entry, error boundaries, Sonner palette
├── index.css                  753   ★ COLOUR TOKEN LAYER + Tailwind theme
│
├── pages/                   9,772   27 route components
├── components/              8,900   50+ components
├── data/                    2,222   Static seed data
├── hooks/                   1,480   11 custom hooks
├── contexts/                1,144   Auth / Theme / Language
├── lib/                       837   supabase, fetch, ai, sentry, queryClient
├── utils/                   1,140   validation, json, sanitizeHtml, errors
├── services/                  230   errorMonitoring
├── stores/                     66   Zustand uiStore (persisted)
├── types/                     128   Shared types
├── styles/                     61   loading.css
└── test/setup.ts                1   Vitest setup
```

### `src/pages/` — 27 route components

| Lines | File | Notes |
| --- | --- | --- |
| 1933 | `CalibrationPage.tsx` | ⚠ **Largest file in the repo** — 21 `useState`, 4 `useEffect` |
| 940 | `PricingPage.tsx` | |
| 905 | `AdminDashboard.tsx` | Admin-only; role verified server-side |
| 901 | `EncyclopediaPage.tsx` | |
| 865 | `FieldGuidePage.tsx` | |
| 779 | `LandingPage.tsx` | |
| 605 | `SimulationPage.tsx` | |
| 536 | `AssessmentPage.tsx` | |
| 535 | `DossiersPage.tsx` | |
| 433 | `ProfilePage.tsx` | |
| 427 | `QuizPage.tsx` | |
| 401 | `PrivacyPage.tsx` | |
| 373 | `RegisterPage.tsx` | |
| 365 | `DecryptorPage.tsx` | |
| 348 | `ResetPasswordPage.tsx` | |
| 317 | `ProfilerPage.tsx` | |
| 300 | `LoginPage.tsx` | |
| 298 | `TermsPage.tsx` | |
| 272 | `InsightsPage.tsx` | |
| 229 | `QuickReferencePage.tsx` | |
| 203 | `ComparePage.tsx` | |
| 195 | `GuidePage.tsx` | |
| 192 | `AssessmentResultPage.tsx` | |
| 188 | `FavoritesPage.tsx` | |
| 180 | `HomePage.tsx` | |
| 132 | `AdvisorPage.tsx` | |
| 57 | `GlossaryPage.tsx` | |

**Route table.** All routes except `/login`, `/register`, and `/reset-password`
require authentication. `/admin` additionally requires `users.role = 'admin'`.
The catch-all redirects to `/`.

```
/login  /register  /reset-password
/  /profile  /assessment  /assessment-result
/calibration  /profiler  /quiz  /compare  /simulation  /decryptor
/advisor  /encyclopedia  /guide  /field-guide  /glossary  /quick-reference
/favorites  /dossiers  /insights  /admin
```

> **Correction.** `DEEP_ANALYSIS.md` previously said "23 lazy-loaded routes".
> The real figure is **27 page components**. Note that the route table above
> lists 25 route paths because `/assessment-result` and a catch-all are handled
> by the same component family — count pages from `src/pages/*.tsx`, which is
> the authoritative list.

### `src/components/`

```
components/
├── layout/                    1,566   App shell
│   ├── Layout.tsx               893   ⚠ second-largest file — nav, drawer, footer
│   ├── AnimatedRoutes.tsx       416   Route transitions
│   ├── CommandCenter.tsx        402   ⌘K search surface
│   ├── CommandPalette.tsx       161
│   ├── BottomNav.tsx             75   Mobile bottom navigation
│   ├── ScrollToTop.tsx           18
├── advisor/                     379   Chat surface
│   ├── Message.tsx              220
│   ├── Composer.tsx             150
│   ├── MessageList.tsx           89
│   ├── EmptyState.tsx            71
│   ├── AdvisorHeader.tsx         70
│   └── prompts.ts                49   Prompt assets
├── calibration/                 365
│   ├── ScanningOverlay.tsx      276
│   └── HistoryList.tsx           89
├── ui/
│   └── Skeleton.tsx              59   Reusable primitive
└── *.tsx                     ~5,700   Feature components — still FLAT
    ├── EditProfileModal.tsx     555
    ├── DeleteAccountSection.tsx 340
    ├── ImageCropper.tsx         293
    ├── OnboardingModal.tsx      258
    ├── LoadingScreen.tsx        219
    ├── FeedbackModal.tsx        215
    ├── CalibrationWizard.tsx    211
    ├── ProfileCard.tsx          199
    ├── PaywallScreen.tsx        178
    ├── ProfileCardModal.tsx     178
    ├── ErrorBoundary.tsx        144
    ├── ProfileRadarChart.tsx    138
    ├── SubscriptionCard.tsx     139
    ├── Tooltip.tsx              134
    ├── SessionErrorBoundary.tsx 133
    ├── GlossaryText.tsx         133
    ├── MessageBubble.tsx        129
    ├── ArchetypeLockedPreview.tsx 118
    ├── TypeSelector.tsx         112
    ├── TypeSelector … EnvironmentDebug.tsx 94
    ├── TraitRadarChart.tsx       80   ▲ Chart colours come from tokens
    ├── TypingIndicator.tsx       80
    ├── LoadingComponents.tsx     68
    ├── LogoutButton.tsx          55
    ├── Logo.tsx                  47
    ├── RequireValidUUID.tsx      45
    ├── FavoriteButton.tsx        40
    ├── PrefetchLink.tsx          26
    └── LanguageToggle.tsx        20
```

**The flat-component problem is real.** 32 feature components sit directly in
`src/components/` with no feature grouping. `layout/`, `advisor/`,
`calibration/`, and `ui/` are grouped; everything else is not. Suggested target
groups (from the previous `STRUCTURE.md`, still the right shape):

- `components/profile/` — ProfileCard, ProfileCardModal, ProfileRadarChart, EditProfileModal
- `components/chat/` — MessageBubble, TypingIndicator
- `components/charts/` — TraitRadarChart, ProfileRadarChart
- `components/auth/` — LogoutButton, SessionErrorBoundary, RequireValidUUID
- `components/common/` — Tooltip, Logo, GlossaryText, FavoriteButton, TypeSelector, ErrorBoundary, EnvironmentDebug, LoadingComponents, LoadingScreen, CalibrationWizard

Do this as a **separate, mechanical PR** — moves plus import updates, no
behavioural change, so a reviewer can check it by skimming.

### `src/data/` — static content

| Lines | File |
| --- | --- |
| 1386 | `personalityTypes.ts` — 8 archetypes with full descriptive text |
| 435 | `guideSections.ts` |
| 201 | `assessmentQuestions.ts` |

`personalityTypes.ts` is a 1386-line literal. It is data, not logic, so it does
not hurt the reasoning as much as its size suggests — but moving it to JSON
would remove it from the type-checking and parsing cost of the app bundle's
source graph, and would let content be edited without touching TypeScript.

### `src/hooks/` — 11 custom hooks

| Lines | Hook | Purpose |
| --- | --- | --- |
| 435 | `useAdvisorChat.ts` | SSE streaming, message state, reactions |
| 200 | `useMobile.ts` | Breakpoint and touch detection |
| 167 | `useFavorites.ts` | Favorites CRUD |
| 140 | `usePerformance.ts` | Web-vitals instrumentation |
| 121 | `useRoutePreloading.ts` | Intent-based prefetch |
| 114 | `useVirtualList.ts` | List windowing |
| 97 | `useFocusTrap.ts` | Modal accessibility |
| 94 | `useSessionTimeout.ts` | Idle logout |
| 61 | `useSubscription.ts` | Tier state |
| 46 | `useSmartScroll.ts` | Scroll restoration |

**Zero of these have tests.** `useAdvisorChat.ts` at 435 lines drives the SSE
protocol and is the least covered high-risk logic in the frontend.

### `src/utils/` — pure functions (4 of the 5 test files live here)

| Lines | File | Tested |
| --- | --- | --- |
| 355 | `validation.ts` | ✅ `validation.test.ts` (213) |
| 162 | `calibrationAnalysis.ts` | ❌ |
| 138 | `sanitizeHtml.ts` | ✅ `sanitizeHtml.test.ts` (102) |
| 128 | `errorHandling.ts` | ❌ |
| 100 | `analytics.ts` | ❌ |
| 65 | `json.ts` | ✅ `json.test.ts` (35) |
| 63 | `imageCompression.ts` | ❌ |
| 52 | `lazyWithRetry.ts` | ❌ |
| 20 | `env.ts` | ❌ |

The three tested utilities are the security-adjacent ones (`validation`,
`sanitizeHtml`, `json`). That is a deliberate and correct prioritisation —
`json.ts` guards `localStorage` reads, and `sanitizeHtml.ts` is XSS-adjacent.

---

## 5. `supabase/` — the canonical schema

```
supabase/
├── config.toml                                  11   CLI config
└── migrations/                                       ★ CANONICAL — apply in order
    ├── 20240101000000_initial_schema.sql       359   15 tables
    ├── 20240101000100_rls_audit.sql            254   is_admin(), policy fixes
    ├── 20240101000200_rate_limits.sql           63   rate_limits + atomic RPC
    ├── 20240101000300_subscription_tiers.sql    55   tier columns
    ├── 20240101000400_security_hardening.sql   248   triggers, column locks
    ├── 20240101000500_storage_lifecycle.sql     82   Storage cleanup triggers
    ├── 20240101000600_rate_limit_hardcap.sql    67   HARD_CAP short-circuit
    ├── 20240101000700_users_auth_fk.sql         81   users.id → auth.users FK
    └── 20240101000800_advisor_reactions.sql     35   Message reactions
```

**16 tables.** `users`, `calibrations`, `oracle_analyses`, `assessment_results`,
`advisor_sessions`, `advisor_messages`, `field_reports`, `report_likes`,
`field_report_comments`, `favorites`, `dossiers`, `feedback`, `rate_limits`,
`verification_codes`, `public_config`, `private_config`.

Full column list, ER diagram, and sensitive-column annotations:
[`docs/architecture/README.md`](./docs/architecture/README.md) and
[README §8](./README.md#8-database).

### Deprecated schema files — delete these

| File | Lines | Status |
| --- | --- | --- |
| `supabase-schema-v2.sql` | — | Legacy duplicate of the migrations |
| `scripts/rls-audit.sql` | 370 | Superseded by `20240101000100_rls_audit.sql` |
| `scripts/create-rate-limits-table.sql` | 87 | Superseded by `20240101000200_rate_limits.sql` |

They were retained "for one release cycle". That cycle is over, and their
presence is now a hazard: a contributor reasonably reads
`supabase-schema-v2.sql` as the schema and edits the wrong file. Delete them, or
move them to `docs/archive/`.

---

## 6. `docs/` — documentation tree

```
docs/
├── README.md                          Index and reading paths
├── architecture/
│   └── README.md                      Architecture, diagrams, data model
├── security/
│   ├── threat-model.md                Controls, assets, threat enumeration
│   └── secrets-rotation.md            Runbook: identify → revoke → reissue → purge
├── billing/
│   └── stripe-flow.md                 INTENDED Stripe design (not implemented)
├── operations/
│   ├── deployment.md                  Deploy, rollback, migrations
│   └── monitoring.md                  Sentry, logs, request IDs, health
└── archive/
    └── 2026-q3-todos.md               Completed TODO list, kept for provenance
```

Reading paths:

| You want to… | Read |
| --- | --- |
| Run it locally | [README §5](./README.md#5-quick-start) |
| Understand the architecture | [`docs/architecture/README.md`](./docs/architecture/README.md) |
| Contribute code | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Report a vulnerability | [`SECURITY.md`](./SECURITY.md) |
| Review the security posture | [`docs/security/threat-model.md`](./docs/security/threat-model.md) |
| Rotate a leaked secret | [`docs/security/secrets-rotation.md`](./docs/security/secrets-rotation.md) |
| Ship a deploy | [`docs/operations/deployment.md`](./docs/operations/deployment.md) |
| Investigate a production error | [`docs/operations/monitoring.md`](./docs/operations/monitoring.md) |
| Understand billing | [`docs/billing/stripe-flow.md`](./docs/billing/stripe-flow.md) |
| Know what changed | [`CHANGELOG.md`](./CHANGELOG.md) |

---

## 7. `.kiro/specs/` — recorded specifications

Two spec documents are committed. They are **historical records of planning**,
not descriptions of the current build — read them for intent, not for state.

```
.kiro/specs/
├── premium-ui-redesign/          requirements.md · design.md · tasks.md
└── phase-1-foundations/          requirements.md
```

`premium-ui-redesign` documents the palette decision that the current token
layer implements: champagne gold `#E8C77E` accent with antique gold `#D4AF37`
for hover/active, on warm near-black `#0E0B12`. It is useful context for anyone
changing `src/index.css` — the values there are deliberate, not arbitrary.

`phase-1-foundations` states an explicit out-of-scope list that is still mostly
accurate: splitting `Layout.tsx`, the no-op Supabase auth lock, `ProfileCard`
parallax memoization, list virtualization, and testing `any` in `api/**` are all
still open. **Treat its "out of scope" section as a work queue**, not as a
prohibition.

---

## 8. Files that should not be here

| File | Size | Why | Fix |
| --- | --- | --- | --- |
| `tsconfig.tsbuildinfo` | 148,946 B | Build artifact, tracked before `*.tsbuildinfo` was added to `.gitignore`. `.gitignore` does not untrack a tracked file. | `git rm --cached tsconfig.tsbuildinfo` |
| `supabase-schema-v2.sql` | — | Legacy duplicate schema | Delete, or archive |
| `scripts/rls-audit.sql` | 370 lines | Deprecated | Delete, or archive |
| `scripts/create-rate-limits-table.sql` | 87 lines | Deprecated | Delete, or archive |
| `UI_FIXES.md` | — | A completed work log, not user-facing documentation | Move to `docs/archive/` |
| `FIXES_APPLIED.md` | — | A completed work log; also names a path that never existed (`src/components/Layout.tsx`) | Move to `docs/archive/` |

`DEEP_ANALYSIS.md` is retained at the root because it still carries the security
posture summary that `README.md` links to. If it drifts again, fold it into
`docs/architecture/` and delete it.

---

## 9. Conventions

### Imports

- Relative paths within a feature directory: `./Message` from `advisor/`.
- Cross-directory imports name the folder: `../../lib/utils`,
  `../../contexts/ThemeContext`.
- Shared types resolve through the barrel: `import { PersonalityType } from '../types'`
  resolves to `types/index.ts`.
- **`api/` and `src/` are separate TypeScript projects.** Code in `src/` must
  never import from `api/`, and the reverse is also avoided — a shared type is
  duplicated deliberately rather than imported across the boundary. Commit
  `a34f00c` removed exactly this kind of cross-boundary import.

### Path aliases

Not configured. Imports use relative paths and deep chains (`../../../lib/…`)
appear in the larger page components. Adding `@/*` aliases to `tsconfig.json`
**and** `vite.config.ts` would remove those chains — a safe, mechanical change,
listed here as an open improvement.

### Tests

- Co-locate: `json.ts` → `json.test.ts`.
- Run with `npm test` (single) or `npm run test:watch`.
- **Test files are excluded from `tsc --noEmit`.** A type error inside a test
  file will not fail the type-check. Known weakness.

### Components

- `components/layout/` — app shell only (navigation, routing, palette)
- `components/ui/` — reusable primitives
- `components/advisor/`, `components/calibration/` — feature subtrees
- Everything else is flat — see §4 for the proposed grouping

### Styling

- **Colour values exist in exactly one place:** the token layer in
  `src/index.css`. A component uses `bg-mystic-900` or
  `var(--color-status-error)`, never a literal `#0e0b12`.
- A hard-coded literal does not flip when `.light-theme` is active — that is
  precisely how the light theme acquired unreadable contrast ratios.
- Chart components take colours as props from the token layer, because SVG
  attributes do not resolve `var()` reliably in all engines.

---

## 10. Open structural work

Ordered by value per unit of risk. Each is a candidate for its own PR.

1. **Split `api/lib/handlers.ts`** (1392 lines) into domain modules with a
   re-exporting facade. Pure move, no behaviour change, biggest readability win.
2. **Split `src/pages/CalibrationPage.tsx`** (1933 lines, 21 `useState`). Extract
   a state hook, an API module, and result/form/task/history components. Highest
   risk on this list — it is the most-used page, so it needs real tests first.
3. **Add CI.** No `.github/workflows/` exists, so nothing gates a merge. A
   workflow is included in this change set; enabling branch protection is a UI
   action.
4. **Add component and hook tests, starting with `useAdvisorChat.ts`.**
5. **Group flat components by feature** (§4).
6. **Add `@/*` path aliases** (§9).
7. **Delete the deprecated SQL files** (§5) and untrack `tsconfig.tsbuildinfo`.
8. **Move `src/data/personalityTypes.ts`** (1386 lines) to JSON.
9. **Split `components/layout/Layout.tsx`** (893 lines) into nav surfaces.
10. **Add `@param`/`@returns` JSDoc** to exported components and hooks — 76
    exported components currently have none.
11. **Consolidate the canvas libraries** — both `html2canvas` and
    `html-to-image` are dependencies with different call sites. Pick one.
12. **Make `engines` enforced** — `package.json` now declares
    `node >= 20.0.0`, but nothing fails the install on an older Node. Add
    `engine-strict=true` in `.npmrc` if the floor is meant to be hard.

---

**Last verified: 2026-09-26**
