# Implementation Plan: Premium UI/UX Redesign — Phase 1

> Companion docs: [`requirements.md`](./requirements.md), [`design.md`](./design.md).
>
> **Phase 1 split (Q4 = c):**
> - **Phase 1A:** Token + utility swap in `src/index.css` only. ~1 day. Ship and review before starting 1B.
> - **Phase 1B:** Navigation polish across 4 files. ~2–3 days. Builds on approved 1A.
>
> Each task has explicit acceptance criteria mapped to requirements. Tasks are ordered for execution; sub-tasks within a parent should be done top-to-bottom.

## Overview

Phase 1 reskins the EPIMETHEUS webapp from a Tinder-pink/orange aesthetic on near-black to a champagne-gold premium palette on warm near-black. The work is split into two sequential checkpoints: 1A is a single-file CSS variable swap that reskins ~99% of the app automatically, and 1B polishes the navigation surfaces (4 files) once the new palette is approved. No functional changes, no new pages, no new dependencies.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1 — Phase 1A token swap (parallel-safe within wave)",
      "tasks": ["1A.1", "1A.2", "1A.3", "1A.4", "1A.5", "1A.6", "1A.8", "1A.15"]
    },
    {
      "name": "Wave 2 — Phase 1A utility class updates (depend on Wave 1 tokens)",
      "tasks": ["1A.7", "1A.9", "1A.10", "1A.11", "1A.12", "1A.13", "1A.14"]
    },
    {
      "name": "Wave 3 — Phase 1A verification & cleanup",
      "tasks": ["1A.16", "1A.17"]
    },
    {
      "name": "Wave 4 — Phase 1B Layout.tsx polish (sequential within file)",
      "tasks": ["1B.1", "1B.2", "1B.3", "1B.4", "1B.5"]
    },
    {
      "name": "Wave 5 — Phase 1B remaining nav files (parallel-safe)",
      "tasks": ["1B.6", "1B.7", "1B.8", "1B.9", "1B.10"]
    },
    {
      "name": "Wave 6 — Phase 1B verification",
      "tasks": ["1B.11"]
    }
  ]
}
```

```
Phase 1A (src/index.css only)
├── 1A.1  Mystic base palette       ─┐
├── 1A.2  Accent palette             │
├── 1A.3  Slate ramp (warm)          │  parallel-safe
├── 1A.4  Status tokens              │  (all edit @theme block)
├── 1A.5  Shadow tokens              │
├── 1A.6  Motion tokens             ─┘
├── 1A.7  Light theme override       (depends on 1A.1–1A.3 token names)
├── 1A.8  Heading + hero classes     (independent)
├── 1A.9  Glass-card                 (depends on 1A.1, 1A.5)
├── 1A.10 Accent gradients           (depends on 1A.2)
├── 1A.11 Glow-accent                (depends on 1A.2)
├── 1A.12 Shimmer-effect             (depends on 1A.2, 1A.6)
├── 1A.13 Atmosphere                 (depends on 1A.2)
├── 1A.14 Scrollbar                  (depends on 1A.2, 1A.3)
├── 1A.15 Audit preserved blocks     (independent verification)
├── 1A.16 Verification gate          (depends on 1A.1–1A.15)
└── 1A.17 ProfileRadarChart cleanup  (parallel to 1A.16, ships in same PR)
        │
        ▼  Owner approval checkpoint
        │
Phase 1B (4 files)
├── 1B.1  Layout: scroll-aware nav   ─┐
├── 1B.2  Layout: active underline    │  edit Layout.tsx
├── 1B.3  Layout: dropdown spring     │  (sequential within file)
├── 1B.4  Layout: search bar         ─┘
├── 1B.5  Layout: wordmark           (independent within Layout.tsx)
├── 1B.6  BottomNav indicator        (independent file)
├── 1B.7  CommandCenter sheen        ─┐  edit CommandCenter.tsx
├── 1B.8  CommandCenter pulse         │  (sequential within file)
├── 1B.9  CommandCenter selected     ─┘
├── 1B.10 Logo hover border          (independent file)
└── 1B.11 Verification gate          (depends on 1B.1–1B.10)
```

## Tasks

---

## Phase 1A — Foundation Token Swap

> Touches one file: `src/index.css`. Goal: reskin the entire app via CSS variables alone.

### 1A.1 — Replace mystic base palette with warm near-black

- [ ] In `@theme` block, change `--color-mystic-950` from `#0a0508` to `#0E0B12`
- [ ] Change `--color-mystic-900` from `#120a12` to `#161118`
- [ ] Change `--color-mystic-800` from `#1a0f1a` to `#1F1A22`
- [ ] Change `--color-mystic-700` from `#251525` to `#2A242F`
- [ ] In `:root` block, change `background-color: #0a0508` to `background-color: #0E0B12`
- [ ] Verify `body` `bg-mystic-950` and `html` background use the variable (they do — no edit needed)

**Maps to:** Requirement 4.1, Q2 decision.
**Done when:** `body` background renders warm near-black on Home page reload.

---

### 1A.2 — Replace accent palette with champagne gold family

- [ ] Change `--color-accent-primary` from `#ff4b6b` to `#E8C77E` (champagne gold)
- [ ] Change `--color-accent-secondary` from `#ff8a5c` to `#B87333` (antique copper)
- [ ] Change `--color-accent-glow` from `#ff2d55` to `#D4AF37` (deeper gold)

**Maps to:** Requirement 2.4, Requirement 4.2/4.3, Q1 decision.
**Done when:** all `bg-accent-primary`, `text-accent-primary`, `border-accent-primary` consumers render gold across the app.

---

### 1A.3 — Re-tune slate ramp with warm undertone

- [ ] Replace all 11 `--color-slate-*` values with the warm-undertone ramp from `design.md` §3.2 (slate-50 #FAF7F2 through slate-950 #0A0806)
- [ ] Verify `body` text uses `text-slate-300` and renders comfortably on the new warm-black base

**Maps to:** Requirement 4.4.
**Done when:** body text reads with warm undertone, no cool blue cast remains anywhere.

---

### 1A.4 — Add status color tokens

- [ ] In `@theme` block, add `--color-status-success: #6FA083`
- [ ] Add `--color-status-warning: #C99B5B`
- [ ] Add `--color-status-error: #C77A6F`
- [ ] Add `--color-status-info: #7A93A8`

**Maps to:** Requirement 4.6.
**Done when:** tokens are declared and referenceable as `bg-status-success` etc. (no consumers wired up in 1A — that's later phase).

---

### 1A.5 — Add elevation/shadow tokens

- [ ] In `@theme`, add `--shadow-flat: none`
- [ ] Add `--shadow-raised: 0 4px 24px -8px rgba(0, 0, 0, 0.4)`
- [ ] Add `--shadow-floating: 0 12px 40px -12px rgba(0, 0, 0, 0.5)`
- [ ] Replace `--shadow-modal` value with `0 24px 80px -16px rgba(0, 0, 0, 0.65)`
- [ ] Update `--shadow-glow` to `0 0 32px -4px rgba(212, 175, 55, 0.18)` (gold, low intensity)
- [ ] Keep `--shadow-card` for backward compat — alias to same value as `--shadow-raised`

**Maps to:** Requirement 7.1, 7.6.
**Done when:** new shadow tokens declared without breaking any existing consumer (which uses `--shadow-card`).

---

### 1A.6 — Add motion tokens

- [ ] In `@theme`, add `--ease-soft: cubic-bezier(0.32, 0.72, 0, 1)`
- [ ] Add `--ease-emphasis: cubic-bezier(0.4, 0, 0.2, 1)`
- [ ] Add `--duration-fast: 150ms`
- [ ] Add `--duration-base: 250ms`
- [ ] Add `--duration-slow: 400ms`
- [ ] Add `--duration-shimmer: 2000ms`

**Maps to:** Requirement 8.1, 8.6.
**Done when:** tokens are declared. Consumers wired up in later phases.

---

### 1A.7 — Update light theme tokens

- [ ] In `.light-theme` block, replace mystic palette per `design.md` §3.4 (`--color-mystic-950: #FAF7F2` cream, etc.)
- [ ] Override `--color-accent-primary` to `#B8860B`, `--color-accent-secondary` to `#8B5A2B`, `--color-accent-glow` to `#9C7421` inside `.light-theme`
- [ ] Replace all `--color-slate-*` values with the inverted warm ramp (slate-50 #14110E through slate-950 #FAF7F2)
- [ ] Confirm `.light-theme` `background-color` and `color` rules still use the variables (they do)

**Maps to:** Requirement 2.3, Requirement 4.5.
**Done when:** toggling theme switches to a warm cream background with deeper gold accent. No missing-color glitches.

---

### 1A.8 — Update global heading rule and add hero/utility classes

- [ ] Change `h1, h2, h3, h4, h5, h6 { @apply font-display ... }` to use `font-sans` instead — Q3 decision: serif is hero-only, not global
- [ ] Add new `.hero-headline` class per `design.md` §4.2 (Cormorant Garamond, weight 300, tight tracking)
- [ ] Add new `.hero-headline-italic` class (Cormorant italic, weight 400)
- [ ] Add new `.eyebrow` class per `design.md` §4.4 (uppercase, tracked 0.18em, weight 600, slate-500)
- [ ] Add new `.tabular-nums` class

**Maps to:** Requirement 5.1, 5.3, 5.5, 5.6, Q3 decision.
**Done when:** existing pages render H1/H2 in Inter (no regression). `.hero-headline` is available for HomePage/LoginPage to opt in (opt-in deferred to Phase 3 page polish).

---

### 1A.9 — Update glass-card with gold hairline and inner sheen

- [ ] Replace `.glass-card` rule body per `design.md` §5.2:
  - Fallback `background-color: rgba(22, 17, 24, 0.85)`
  - `border: 1px solid rgba(232, 199, 126, 0.08)` (gold hairline)
  - `border-radius: var(--radius-lg)`
  - `box-shadow: var(--shadow-raised)`
- [ ] Update the `@supports (backdrop-filter)` block to use `background-color: rgba(22, 17, 24, 0.55)` and `backdrop-filter: blur(20px)`
- [ ] Add `.glass-card::before` pseudo-element with the top-edge gold gradient sheen per `design.md` §5.2

**Maps to:** Requirement 7.2.
**Done when:** glass cards on Home and Profile pages show subtle gold hairline + inner top sheen.

---

### 1A.10 — Update accent gradients

- [ ] Replace `.accent-gradient` with `linear-gradient(135deg, #E8C77E 0%, #D4AF37 50%, #B87333 100%)`
- [ ] Replace `.text-gradient` with `linear-gradient(90deg, #E8C77E 0%, #F0D89A 50%, #D4AF37 100%)` (champagne shimmer)
- [ ] `.mystic-gradient` is unchanged (uses `--color-mystic-*` tokens — auto-reskins)

**Maps to:** Requirement 4.7, Requirement 10.7.
**Done when:** any element using `accent-gradient` or `text-gradient` shows the gold palette.

---

### 1A.11 — Update glow-accent

- [ ] Replace `.glow-accent` `box-shadow` value to `0 0 24px -4px rgba(212, 175, 55, 0.18)`

**Maps to:** Requirement 4.7, Requirement 7.6.
**Done when:** glow effects render as soft gold halo.

---

### 1A.12 — Update shimmer-effect

- [ ] In `.shimmer-effect::after`, replace `background` linear-gradient white tints (`rgba(255,255,255,...)`) with gold tints `rgba(232, 199, 126, ...)` at the same opacity stops, but reduce the `0.08` peak to `0.06`
- [ ] Change `animation` duration in `.shimmer-effect::after` from `1.5s` to `var(--duration-shimmer)` (2s)

**Maps to:** Requirement 8.5, Requirement 9.8.
**Done when:** skeleton loaders shimmer with subtle gold pass at slower cadence.

---

### 1A.13 — Update atmosphere gradients

- [ ] Replace `.atmosphere` background radial gradients per `design.md` §6.2:
  - `radial-gradient(circle at 50% 30%, rgba(212, 175, 55, 0.06) 0%, transparent 60%)`
  - `radial-gradient(circle at 10% 80%, rgba(184, 115, 51, 0.04) 0%, transparent 50%)`
- [ ] Reduce `opacity` from `0.82` to `0.7` (gold reads more saturated than pink at same alpha)

**Maps to:** Requirement 4.7.
**Done when:** background atmosphere has subtle gold + copper bloom instead of pink/orange.

---

### 1A.14 — Update scrollbar

- [ ] In `::-webkit-scrollbar-thumb`, change `background` from `rgba(255, 255, 255, 0.15)` to `rgba(196, 186, 171, 0.18)` (warm slate-300 tint at 18%)
- [ ] In `::-webkit-scrollbar-thumb:hover`, change `background` from `rgba(255, 255, 255, 0.3)` to `rgba(232, 199, 126, 0.35)` (gold tint at 35%)
- [ ] Update `* { scrollbar-color: rgba(255, 255, 255, 0.15) transparent }` to use `rgba(196, 186, 171, 0.18) transparent`

**Maps to:** Requirement 4.4.
**Done when:** scrollbar reads warm and accents gold on hover.

---

### 1A.15 — Verify preserved blocks (audit, no edit)

- [ ] Confirm `@media (prefers-reduced-motion: reduce)` block is unchanged
- [ ] Confirm `.sr-only` rule is unchanged
- [ ] Confirm `.tap-target` rule is unchanged
- [ ] Confirm `.safe-area-*` rules are unchanged
- [ ] Confirm `:focus-visible` rule is unchanged (still uses `--color-accent-primary` which now resolves to gold automatically)
- [ ] Confirm `body` `selection:bg-accent-primary/30` (in `@apply` directive) is unchanged

**Maps to:** Requirement 11.2, 11.5, 11.6, 11.7, Requirement 12.
**Done when:** all accessibility primitives are intact.

---

### 1A.16 — Phase 1A verification

- [ ] Run `npm run lint` — passes
- [ ] Run `npm run lint:api` — passes
- [ ] Run `npm run build` — passes
- [ ] Run `npm run test` — passes
- [ ] Manual smoke test (dev server): visit `/`, `/profile`, `/advisor`, `/calibration` — all render with new gold + warm-black look, no console errors
- [ ] Toggle theme to light — pages render with cream + deeper gold, no missing-color glitches
- [ ] Contrast spot check on body text (`text-slate-300` on `bg-mystic-950`) — passes WCAG AA (expected ~10.8:1 dark, ~5.6:1 light)
- [ ] Contrast spot check on a primary CTA (`bg-accent-primary` button) — passes WCAG AA against page base
- [ ] Contrast spot check on nav active state — passes
- [ ] Note: `ProfileRadarChart.tsx` will still render pink — that's tracked in 1A.17 below

**Maps to:** Requirement 12.4, Phase 1 DoD in requirements.md.
**Done when:** all checkmarks pass. Phase 1A is shippable at this point.

---

### 1A.17 — Hardcoded color cleanup (tracked, do in same PR if time, otherwise immediate follow-up)

- [ ] Audit `src/components/ProfileRadarChart.tsx`: replace hardcoded `#ff4b6b` references with a value sourced from CSS variable. Recommended approach: add a `color` prop to the component that defaults to reading `getComputedStyle(document.documentElement).getPropertyValue('--color-accent-primary').trim()` once on mount, store in state.
- [ ] Run a project-wide grep for raw pink/orange hex (`#ff4b6b`, `#ff8a5c`, `#ff2d55`) and replace any other findings with the token-driven approach.

**Maps to:** Requirement 2.1, 2.2, Correctness Property 1 (token source-of-truth).
**Done when:** project-wide grep returns zero hits for those raw hex values outside `index.css`.

---

## Phase 1A → 1B Checkpoint

**Stop here. Owner reviews. Confirm:**
- Direction feels "premium luxury" as defined in Requirement 1
- Champagne gold reads correctly across surfaces (not too yellow, not too brown)
- Warm near-black holds the mystic identity
- No regressions on data displays or modals

If owner approves direction, proceed to Phase 1B. If owner wants to tune (e.g., shift gold deeper toward `#D4AF37` as primary, or warm the base more toward `#100D14`), make those token-only edits and re-verify before moving on.

---

## Phase 1B — Navigation Polish

> Touches 4 files: `Layout.tsx`, `BottomNav.tsx`, `CommandCenter.tsx`, `Logo.tsx`. Builds on approved Phase 1A tokens.

### 1B.1 — Layout.tsx desktop nav: scroll-aware transparency

- [ ] In `Layout.tsx`, locate the top `<header>` / `<nav>` element that uses the `scrolled` state
- [ ] Apply `bg-mystic-950/0 backdrop-blur-md` at `scrolled === false` and `bg-mystic-950/80 backdrop-blur-xl border-b border-slate-700/20` at `scrolled === true`
- [ ] Add `transition-[background-color,backdrop-filter,border-color] duration-300` (≤300ms per Req 10.2)

**Maps to:** Requirement 10.1, 10.2.
**Done when:** at scroll-top, page hero shows through nav edge. After scrolling, nav becomes opaque with hairline bottom border, transition is smooth.

---

### 1B.2 — Layout.tsx active nav item: underline replaces fill

- [ ] In the desktop nav item rendering block (around line 325–340 per current state), find the active-state condition
- [ ] Remove `bg-accent-primary/5` from active classes
- [ ] Keep `text-accent-primary` for active text color
- [ ] The existing `<div className="absolute bottom-0 left-3 right-3 h-0.5 bg-accent-primary rounded-full" />` underline element stays — verify it's still rendered when active
- [ ] Add a subtle icon glow when active: wrap the icon (or apply via className) with `drop-shadow-[0_0_8px_rgba(232,199,126,0.4)]`
- [ ] Apply the same active treatment in the dropdown group items (around line 364–402)

**Maps to:** Requirement 10.3.
**Done when:** active nav item shows gold underline + glowing icon, no background fill pill.

---

### 1B.3 — Layout.tsx dropdown animations & padding

- [ ] Locate the dropdown panel render (Tools, Reference, Profile groups)
- [ ] Update the motion `animate` / `initial` props to use a soft spring (`{ type: "spring", stiffness: 240, damping: 28 }`)
- [ ] Update `transition` to a duration of 250ms with `ease: [0.32, 0.72, 0, 1]` (matches `--ease-soft`)
- [ ] Set internal padding to `p-3` minimum (≥12px)
- [ ] Apply `box-shadow: var(--shadow-floating)` via inline style or `shadow-[var(--shadow-floating)]` Tailwind arbitrary

**Maps to:** Requirement 10.4, Requirement 7.1, Requirement 8.1.
**Done when:** dropdowns ease in confidently (not bouncy), have generous padding, sit at floating elevation.

---

### 1B.4 — Layout.tsx search bar: gold border + single-cycle pulse

- [ ] In the search input render (around line 421–433), update the input `className` so `focus:border-accent-primary/50` becomes `focus:border-accent-primary/60` and the focus state shows a subtle box-shadow ring as well: `focus:shadow-[0_0_0_3px_rgba(232,199,126,0.12)]`
- [ ] In the search icon (`<Search>`, around line 422), add a `group-focus-within:animate-[pulse-once_600ms_ease-out]` (single-cycle pulse — define `@keyframes pulse-once` in `index.css` if not present)
- [ ] Find the `kbd` hint element (the cmd+K hint) inside the search bar — update its border to `border-accent-primary/15`

**Maps to:** Requirement 10.5.
**Done when:** focusing the search bar shows gold border + soft ring + a single icon pulse (not infinite).

#### Sub-task: add `pulse-once` keyframe (if not present)

- [ ] In `index.css`, add:
  ```css
  @keyframes pulse-once {
    0%   { transform: scale(1);   opacity: 1; }
    50%  { transform: scale(1.15); opacity: 0.8; }
    100% { transform: scale(1);   opacity: 1; }
  }
  ```

---

### 1B.5 — Layout.tsx EPIMETHEUS wordmark gradient

- [ ] Find the EPIMETHEUS text element near the `<Logo />` in the header
- [ ] If it currently uses a hardcoded gradient like `bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400`, replace with `text-gradient` utility class (now gold per Phase 1A)
- [ ] If it already uses `text-gradient`, no edit needed (auto-reskinned)

**Maps to:** Requirement 10.7.
**Done when:** wordmark renders with champagne→gold→deep-gold gradient.

---

### 1B.6 — BottomNav.tsx active indicator

- [ ] In `BottomNav.tsx` (~line 39–43), keep `text-accent-primary` for active items
- [ ] Add an active indicator below the icon: render a `<span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-primary" />` (gold dot) OR a 2px gold underline `<span className="absolute -bottom-0 left-4 right-4 h-0.5 bg-accent-primary rounded-full" />`
- [ ] Inactive state: confirm `text-slate-400 hover:text-slate-200` reads with warm undertone after Phase 1A slate ramp update

**Maps to:** Requirement 10.6.
**Done when:** mobile bottom nav active item has visible gold dot/underline, no fill pill.

---

### 1B.7 — CommandCenter.tsx: metallic sheen on floating button

- [ ] In `CommandCenter.tsx` around line 176–189, the gradient classes `from-accent-primary via-accent-secondary to-accent-primary` auto-reskin via Phase 1A
- [ ] Inside the button, add a sheen overlay layer: `<div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />`
- [ ] This layer adds the "polished metal" highlight on the button

**Maps to:** Requirement 10.8.
**Done when:** floating button reads as a polished gold disc, not just flat gold.

---

### 1B.8 — CommandCenter.tsx: remove infinite pulse, hover-only

- [ ] Find the pulsing ring around the button (around line 216–217) with `transition={{ duration: 1, repeat: Infinity }}`
- [ ] Wrap the pulse animation in a hover-conditional render: only render when the button is hovered (e.g., gate by a `isHovering` state set via `onMouseEnter` / `onMouseLeave`)
- [ ] OR replace `repeat: Infinity` with `repeat: 0` and trigger via `whileHover` from the parent button

**Maps to:** Requirement 8.5, Requirement 10.8.
**Done when:** the button does not pulse infinitely on idle. On hover, a single soft pulse (or a slow repeating one only while hovered) appears.

---

### 1B.9 — CommandCenter.tsx: verify selected-item border opacity

- [ ] Around line 299–303, the selected item uses `bg-accent-primary/10 border border-accent-primary/20 shadow-lg shadow-accent-primary/10`
- [ ] Confirm `/20` border opacity is in 5–15% range per Requirement 7.5 — if too bright, drop to `/15`
- [ ] No other change needed (auto-reskins via Phase 1A)

**Maps to:** Requirement 7.5.
**Done when:** selected-item highlight is subtle, not loud.

---

### 1B.10 — Logo.tsx: gold hairline border on hover (when in nav)

- [ ] In `Logo.tsx`, the outer container uses `border border-white/10`. Change to `border border-white/10 hover:border-accent-primary/15 transition-colors duration-200`
- [ ] Verify the LogoIcon variant has the same hover treatment

**Maps to:** Requirement 10.7.
**Done when:** hovering the Logo shows a faint gold edge.

---

### 1B.11 — Phase 1B verification

- [ ] Run `npm run lint` — passes
- [ ] Run `npm run lint:api` — passes
- [ ] Run `npm run build` — passes
- [ ] Run `npm run test` — passes
- [ ] Manual smoke test all 22 routes: every page loads, no runtime errors, no broken layouts
- [ ] Keyboard nav: Tab through `Layout.tsx` header, dropdowns open with Enter, Escape closes, focus rings visible on every step
- [ ] Mobile responsive check (devtools narrow viewport): top nav collapses to hamburger, BottomNav renders, active state visible
- [ ] Theme toggle: light theme nav still readable, no missing-color glitches
- [ ] Reduced motion: enable `prefers-reduced-motion: reduce` in OS, verify no animations play, transitions are instant
- [ ] Confirm `ProfileRadarChart` from 1A.17 has been addressed — no raw pink in app

**Maps to:** Requirement 11, Requirement 12.4, Phase 1 DoD.
**Done when:** all checkmarks pass.

---

## Phase 1 Final Checklist (1A + 1B Combined)

- [ ] All 1A and 1B tasks above are checked
- [ ] App-wide grep for raw `#ff4b6b`, `#ff8a5c`, `#ff2d55` returns zero hits outside `index.css`
- [ ] App-wide grep for `font-display` in `.tsx` files: any usage on H1/H2 in non-hero contexts is replaced with `font-sans` or removed
- [ ] WCAG AA spot-checks on body text, accent CTAs, nav active state — all pass in both themes
- [ ] No new console errors or warnings introduced
- [ ] Bundle size delta: measured via `npm run build:analyze`, JS delta < 5%, CSS delta < 5 KB

---

## Notes

### Out-of-Scope for Phase 1 (Belongs in Later Phases)

These are explicitly **not** Phase 1 work — they live in Phase 2+ per the requirements doc:

- `ProfileRadarChart.tsx` color refactor *(promoted into 1A.17 because it's a token-bypass leak; cleanup goes with 1A or immediately after)*
- Recharts theme integration across all chart consumers (Insights page) — Phase 3
- Icon stroke-width = 1.5 globally — Phase 2 (introduce a `<Icon>` wrapper) or per-page polish in 3+
- New motion preset constants in `src/lib/motion.ts` (TS file, not CSS) — Phase 2
- Page-level redesigns (Home, Profile, Advisor, etc.) — Phase 3+
- Toast (sonner) theming — Phase 2 or 3
- Modal scale-in animation polish — Phase 2 or 3
- Skeleton loader gold shimmer behavior verification across all consumers — Phase 2
