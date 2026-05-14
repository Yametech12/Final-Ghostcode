# Project Structure

## Current Layout

```
Final-Ghostcode/
├── api/                          # Express + Vercel serverless backend
│   ├── ai/                       # AI-related endpoints
│   ├── auth/                     # Auth endpoints (send-code, verify-code)
│   ├── lib/                      # Shared API helpers
│   └── index.ts                  # Local dev server entry
│
├── scripts/                      # One-off scripts (diagnose, setup, debug)
│   ├── debug-script.js
│   ├── diagnostic.ts
│   └── ...
│
├── src/
│   ├── components/
│   │   ├── layout/               # App shell: Layout, AnimatedRoutes, nav, palette
│   │   │   ├── AnimatedRoutes.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── CommandCenter.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── ScrollToTop.tsx
│   │   ├── ui/                   # Primitive UI (Skeleton, ...)
│   │   └── *.tsx                 # Feature components (still flat — see TODO)
│   │
│   ├── contexts/                 # React Context providers
│   │   ├── EnhancedAuthContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── data/                     # Static seed data (questions, types, glossary)
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Cross-cutting libs (supabase, ai, queryClient, utils)
│   ├── pages/                    # Route-level page components
│   ├── services/                 # External service wrappers (regolo, errorMonitoring)
│   ├── stores/                   # Zustand stores
│   ├── styles/                   # Standalone CSS
│   ├── test/                     # Test setup
│   │   └── setup.ts
│   ├── types/                    # Shared TypeScript types
│   │   ├── content.ts
│   │   ├── index.ts              # Barrel re-export
│   │   ├── personality.ts
│   │   └── user.ts
│   ├── utils/                    # Pure utilities (json, validation, errorHandling)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
└── public/                       # Static assets
```

## Conventions

### Imports
- Use relative paths within a feature: `./Layout` from another `layout/` file.
- Cross-feature imports go through the folder name: `../../lib/utils`, `../../contexts/ThemeContext`.
- Shared types: `import { PersonalityType } from '../types'` — the barrel resolves to `types/index.ts`.

### Tests
- Co-locate tests next to the file: `json.ts` + `json.test.ts`.
- Run: `npm test` (single run) or `npm run test:watch`.
- TypeScript test files are excluded from `tsc --noEmit` (configured in `tsconfig.json`).

### Components
- `components/layout/` — app shell only (nav, routing, palette).
- `components/ui/` — reusable primitives.
- Other components are still flat. See "TODO" below.

## TODO: Future Improvements

These were considered but skipped to avoid risky refactors without test coverage.

1. **Group remaining components by feature**:
   - `components/profile/` — ProfileCard, ProfileCardModal, ProfileRadarChart, EditProfileModal
   - `components/chat/` — MessageBubble, TypingIndicator
   - `components/feedback/` — FeedbackModal, OnboardingModal, OnboardingTour
   - `components/auth/` — LogoutButton, SessionErrorBoundary, SessionErrorHandler, RequireValidUUID
   - `components/charts/` — TraitRadarChart, ProfileRadarChart
   - `components/common/` — Tooltip, Logo, GlossaryText, FavoriteButton, TypeSelector, ErrorBoundary, EnvironmentDebug, LoadingComponents, LoadingScreen, CalibrationWizard

2. **Group pages by feature** (`pages/auth/`, `pages/assessment/`, `pages/tools/`, `pages/reference/`).

3. **Split large files**:
   - `components/layout/Layout.tsx` (~670 lines) → extract `Footer.tsx`, `MobileNav.tsx`, `DesktopNav.tsx`.
   - `pages/CalibrationPage.tsx` (~1500 lines) → extract `CalibrationForm`, `CalibrationResult`, `TaskList`, `HistoryView`.

4. **Add path aliases** in `tsconfig.json`:
   ```json
   "paths": {
     "@/*": ["./src/*"],
     "@components/*": ["./src/components/*"],
     "@hooks/*": ["./src/hooks/*"],
     "@lib/*": ["./src/lib/*"],
     "@types/*": ["./src/types/*"]
   }
   ```
   This eliminates `../../../` import chains.

5. **Expand test coverage** — currently only `utils/json.ts` has tests.

6. **Address npm vulnerabilities**: `npm audit fix` (4 moderate, 5 high).
