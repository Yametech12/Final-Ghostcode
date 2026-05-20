# Requirements Document — Premium UI/UX Redesign

## Introduction

The EPIMETHEUS webapp currently uses a Tinder-inspired pink/orange aesthetic on a dark mystic background. The product owner wants to elevate the entire visual experience to a **premium luxury** look across all 22 pages and shared layout, while preserving every existing feature and behavior. This is a pure visual/interaction uplift — no functional changes.

The redesign covers the global navigation, three navigation groups (Core, Tools, Reference), all individual pages, shared components (cards, buttons, modals, inputs, charts), and the overall sensory feel (color, typography, motion, iconography, micro-interactions).

The work is scoped into **five phases** so the owner can ship incrementally and validate the new direction on a small surface before rolling it out everywhere.

### Out of Scope
- Backend, API, or data model changes
- New features or pages
- Authentication / authorization changes
- Copy/content rewrites (only typography treatment changes)
- Mobile native app

### Stakeholders
- **Product owner** — wants a premium luxury feel that signals quality and sophistication
- **End users** — existing users who must not lose any feature; new users who form first impression from polish
- **Developers (future)** — must be able to apply the design system to new pages without re-deriving tokens

---

## Glossary

- **Design tokens** — Named values (colors, spacing, radii, shadows, motion) declared once in CSS and consumed everywhere. The single source of truth for the visual language.
- **Glass card** — A surface with translucent background, backdrop blur, subtle border, and shadow. Currently exists as `.glass-card`.
- **Premium luxury** — Concrete visual principles defined in **Requirement 1**. Not a vague vibe — a checklist.
- **Motion preset** — A reusable easing/duration combo (e.g., "soft-spring", "page-enter") declared once and applied via class or `motion` variants.
- **WCAG AA** — Web Content Accessibility Guidelines level AA. Minimum contrast ratio 4.5:1 for body text, 3:1 for large text and UI components.
- **prefers-reduced-motion** — A user OS-level preference that disables non-essential animation. Already respected globally in `index.css`.
- **Phase** — A self-contained shippable slice of the redesign. Each phase leaves the app in a working, releasable state.

---

## Requirements

### Requirement 1 — Define "Premium Luxury" as Concrete Visual Principles

**User Story:** As a product owner, I want "premium luxury" defined as a concrete checklist (not a vibe), so that every design decision can be measured against it and the result is consistent across pages.

#### Acceptance Criteria

1. WHEN the design system is documented, THEN the system SHALL include a written "Luxury Principles" section that defines at minimum: (a) color philosophy, (b) typography hierarchy, (c) spacing rhythm, (d) elevation/depth model, (e) motion personality, (f) iconography style.
2. WHERE color is defined, the system SHALL use a **deep neutral base** (near-black with a slight warm/cool tint, not pure black) paired with a **single metallic accent** (champagne gold OR rose gold OR platinum — owner picks one) and a restrained secondary accent for emphasis only.
3. WHERE typography is defined, the system SHALL pair a **display serif** (e.g., Cormorant Garamond — already loaded) with a **refined sans** (e.g., Inter — already loaded) and reserve the serif for headlines/quotes only.
4. WHERE elevation is defined, the system SHALL use no more than **four elevation levels** (flat, raised card, floating panel, modal) each with a documented shadow + optional border + optional inner highlight.
5. WHERE motion is defined, the system SHALL use easing curves that feel "weighted and confident" (e.g., custom cubic-bezier favoring a soft start and firm settle), durations between 200–500ms for UI transitions, and SHALL NOT use bounce or rubbery springs as the default.
6. WHERE iconography is defined, the system SHALL standardize on a **single stroke weight** (1.5px) and a **single icon family** (lucide-react, already in use) with documented sizing scale (16/20/24/32).
7. IF any page introduces a color, font, shadow, or radius outside the documented tokens, THEN that page SHALL be considered non-compliant and MUST be flagged in code review.

---

### Requirement 2 — Establish a Token-First Design System

**User Story:** As a developer, I want all visual values driven by named tokens so that a single change updates the whole app and pages can't drift.

#### Acceptance Criteria

1. WHEN the design system is implemented, THEN all colors, font sizes, spacing, radii, shadows, and motion durations SHALL be declared as CSS custom properties in the `@theme` block of `src/index.css`.
2. WHEN a component needs a color, THEN it SHALL reference a token (e.g., `bg-surface-1`, `text-accent-gold`) and SHALL NOT use a raw hex or arbitrary Tailwind color.
3. WHILE a user toggles between dark and light theme, THEN the same token names SHALL resolve to theme-appropriate values without component code changes.
4. WHERE the existing app uses `--color-accent-primary` (Tinder pink) and `--color-accent-secondary` (Tinder orange), the redesign SHALL replace these values with the new luxury palette but SHALL keep the same token names so existing code continues to work.
5. IF a new token is added, THEN it SHALL be documented in a single design-tokens reference file with: name, value (dark + light), purpose, and example usage.
6. WHEN tokens are defined for the dark theme, THEN every dark-theme color SHALL meet WCAG AA contrast (4.5:1 body, 3:1 large) against its intended background, and the same SHALL apply to the light theme.

---

### Requirement 3 — Phased Rollout (Phase 1 Foundation First)

**User Story:** As a product owner, I want the redesign delivered in shippable phases so I can review and adjust direction before the whole app is touched.

#### Acceptance Criteria

1. WHEN the work is planned, THEN it SHALL be split into exactly five phases as defined below, each independently shippable.
2. **Phase 1 — Foundation (highest priority, ship first):**
   - Update `@theme` tokens in `index.css` to the new luxury palette (replace pink/orange with gold/champagne, deepen base)
   - Update `.glass-card`, `.accent-gradient`, `.text-gradient`, `.mystic-gradient`, `.glow-accent`, `.shimmer-effect` utility classes to match
   - Update typography scale, focus ring, scrollbar, selection colors
   - Update light-theme overrides
   - Outcome: existing pages immediately look new without touching page code
3. **Phase 2 — Shared Layout & Navigation:**
   - `Layout.tsx` (top nav, dropdowns, search bar, mobile menu)
   - `BottomNav.tsx` (mobile bottom nav)
   - `CommandCenter.tsx` / `CommandPalette.tsx` (cmd+K)
   - `Logo.tsx` glow and treatment
4. **Phase 3 — Core Pages:** Home, Profile, Dossiers, Favorites, Insights
5. **Phase 4 — Tools Pages:** Profiler, Decryptor, Simulation, Calibration, Advisor, Compare, Quiz
6. **Phase 5 — Reference Pages:** Guide, Field Guide, Encyclopedia, Glossary, Quick Reference; plus polish pass on Login, Register, Assessment, AssessmentResult, AdminDashboard
7. WHEN a phase is delivered, THEN the app SHALL build, lint, and run with no regressions and SHALL be visually consistent within itself even if later phases haven't shipped yet.
8. IF a phase introduces a token or component used by a later phase, THEN that token/component SHALL be documented when introduced (not retroactively).

---

### Requirement 4 — Premium Color Palette

**User Story:** As a user, I want the colors to feel sophisticated and intentional so the product communicates quality at first glance.

#### Acceptance Criteria

1. WHEN the dark theme is rendered, THEN the base background SHALL be a deep warm-neutral (near-black with subtle warmth, e.g., `#0B0A0F` to `#100D14` range) — NOT pure black, NOT the current `#0a0508`.
2. WHEN the dark theme is rendered, THEN the primary accent SHALL be a metallic gold/champagne in the range of `#D4AF37` to `#E8C77E` (final shade chosen during design phase) used sparingly for CTAs, active states, and key emphasis only.
3. WHERE a secondary accent is needed, the system SHALL use a refined burnished tone (e.g., antique copper `#B87333` or rose gold `#B76E79`) for highlights, NOT a saturated bright color.
4. WHERE neutral text/UI surfaces are needed, the system SHALL provide a 10-step grayscale ramp from near-white to near-black with **warm undertone** (not slate's cool blue cast) so the palette feels cohesive.
5. WHILE the user is on the light theme, THEN the base SHALL be a warm off-white (e.g., `#FAF7F2` ivory/cream) — NOT pure white — and accents SHALL use slightly deeper gold for contrast.
6. IF a status color is needed (success, warning, error, info), THEN the system SHALL provide muted/desaturated versions of green/amber/red/blue that harmonize with the gold accent, NOT vibrant defaults.
7. WHEN gradients are used, THEN they SHALL be subtle (low contrast within the gradient) and SHALL avoid the "Instagram sunset" vibe — preferred patterns: gold-to-champagne, deep-base-to-slightly-lighter-deep-base, accent-to-transparent.

---

### Requirement 5 — Refined Typography

**User Story:** As a user, I want text hierarchy that feels editorial and considered, not generic SaaS, so the product reads as premium.

#### Acceptance Criteria

1. WHEN headlines (h1, h2) render, THEN they SHALL use the display serif (`Cormorant Garamond` or equivalent) with **lighter weight** (300–400) at large sizes for an editorial feel.
2. WHEN body text renders, THEN it SHALL use Inter at 15–16px base with line-height 1.6–1.7 for comfortable reading.
3. WHERE numerical/data displays are needed (dashboard stats, charts), the system SHALL use Inter with **tabular numerals** (`font-feature-settings: "tnum"`) to keep alignment.
4. WHERE quotes, taglines, or italic flourishes appear, the system SHALL use the serif italic to reinforce the editorial tone.
5. WHERE labels, buttons, and small UI text appear, the system SHALL use Inter with `letter-spacing: 0.01em` to 0.04em (slightly wider) and weight 500–600 for clarity at small sizes.
6. WHEN a heading uses uppercase tracking (e.g., section labels), THEN letter-spacing SHALL be at least `0.15em` and font weight SHALL be 600+.
7. IF body text contrast falls below WCAG AA (4.5:1) on any surface, THEN the color SHALL be adjusted before that page is considered done.

---

### Requirement 6 — Iconography Upgrade

**User Story:** As a user, I want icons that feel consistent and premium across the app, not a mix of styles.

#### Acceptance Criteria

1. WHEN icons render anywhere in the app, THEN they SHALL come from `lucide-react` only (already in use) — no inline SVGs, no other icon libraries.
2. WHEN an icon renders inside a button or nav item, THEN its stroke width SHALL be set to 1.5 (lucide default is 2) for a more refined feel — applied globally via a default prop or wrapper.
3. WHEN icons are sized, THEN they SHALL use the documented scale: 16px (inline body), 20px (default UI), 24px (nav, primary actions), 32px (hero, large cards). No arbitrary sizes.
4. WHERE an icon represents a navigation destination (Profiler, Decryptor, etc.), the system SHALL audit the current icon choice and replace any that don't read clearly at 16/20px or that feel off-tone (e.g., overly playful).
5. WHEN an icon is the only content of an interactive element, THEN it SHALL have a `aria-label` or be wrapped in `sr-only` text.
6. WHERE an icon serves as decoration only (e.g., the giant `Heart` in HomePage at `opacity-10`), the system SHALL mark it `aria-hidden="true"` and ensure it doesn't break the layout grid.

---

### Requirement 7 — Elevation, Surfaces, and Glass Treatment

**User Story:** As a user, I want a clear sense of depth and hierarchy so I instinctively know what's foreground, background, and interactive.

#### Acceptance Criteria

1. WHEN a surface is rendered, THEN it SHALL belong to one of four elevation levels: `flat` (no shadow, sits on base), `raised` (small shadow, default cards), `floating` (larger shadow, dropdowns/popovers), `modal` (largest shadow + scrim).
2. WHEN a card uses the glass treatment, THEN it SHALL combine: backdrop-blur 16–24px, translucent fill at 50–70% opacity, 1px hairline border at low opacity, and a subtle inner top-edge highlight (1px gradient line) for the "polished glass" feel.
3. WHERE a card is interactive (clickable), THEN hover SHALL lift the elevation by one step AND brighten the border slightly (≤200ms transition).
4. WHILE a modal is open, THEN the backdrop SHALL apply blur (8–12px) AND a darkening scrim (60–70% opacity) for clear focus.
5. WHEN borders are used, THEN they SHALL be hairline (1px) at low opacity (5–15%) — never thick or solid colored — except for `:focus-visible` rings which use the accent gold at full opacity.
6. IF a surface uses a shadow, THEN the shadow SHALL be soft and large-radius (low blur, big spread) — NOT tight and dark — to keep the luxury feel. No `shadow-black/50` style harsh shadows.

---

### Requirement 8 — Motion Personality

**User Story:** As a user, I want animations that feel deliberate and weighted so interactions feel premium rather than gimmicky.

#### Acceptance Criteria

1. WHEN UI elements transition (color, opacity, transform), THEN the default duration SHALL be 250ms and the default easing SHALL be a custom cubic-bezier favoring a soft start and firm settle (e.g., `cubic-bezier(0.4, 0, 0.2, 1)` or refined variant).
2. WHEN page-level enter animations play (using `motion`), THEN they SHALL stagger children at 80–120ms intervals (not 100ms+ that feels slow, not 30ms that feels rushed) and use a soft spring (stiffness 200–300, damping 25–35).
3. WHERE hover scales are applied, THEN scale SHALL NOT exceed 1.03 (currently some buttons use 1.05 which feels juvenile). Use brightness/border-color shifts as primary hover signals instead.
4. WHILE the user has `prefers-reduced-motion: reduce`, THEN ALL non-essential animation SHALL be disabled (already implemented globally — verify it stays intact).
5. WHEN scroll-triggered or shimmer animations run (e.g., `.shimmer-effect`, `.animate-scanner`), THEN they SHALL be subtle and slow (≥1.5s cycles) and SHALL NOT loop infinitely on always-visible elements unless the user is actively waiting (loading states).
6. IF a new motion preset is needed, THEN it SHALL be added as a named token (e.g., `--motion-soft-spring`, `--motion-page-enter`) and consumed by name, not redefined inline.

---

### Requirement 9 — Component-Level Premium Treatments

**User Story:** As a user, I want every interactive element (button, input, card, modal, chart) to feel polished, so the experience is consistently premium.

#### Acceptance Criteria

1. WHEN a primary button (CTA) renders, THEN it SHALL use the gold accent gradient with a subtle inner highlight, soft outer glow, weighted typography (semibold + slight letter-spacing), and a press depression on `:active` (translateY 1px or scale 0.98).
2. WHEN a secondary button renders, THEN it SHALL use a glass treatment (translucent fill + hairline border) with a hover state that brightens the border to gold at low opacity.
3. WHEN an input or textarea renders, THEN the field SHALL have: hairline border at rest, gold border at low opacity on `:hover`, gold full-opacity ring on `:focus-visible`, and a subtle inner shadow to suggest depth.
4. WHEN a card renders, THEN it SHALL include rounded corners using the documented radius tokens (16px default, 24px large), one of the four elevation levels, and consistent padding from the spacing scale.
5. WHEN a modal opens, THEN the dialog SHALL center, scale-in from 0.96 with opacity fade (≤300ms), have generous padding, and use the floating elevation level on top of a blurred scrim.
6. WHEN charts (recharts) render, THEN their colors SHALL come from the new palette (gold + warm grays + muted status colors) and tooltips/grids SHALL match the glass-card treatment, NOT recharts defaults.
7. WHEN a toast (sonner) renders, THEN its theme SHALL be configured to use the new tokens (deep base background, gold success accent, muted error red, hairline border).
8. WHERE skeleton loaders render, THEN their shimmer animation SHALL be slowed to 1.8–2.2s and use a low-opacity gold gradient pass instead of pure white shimmer.

---

### Requirement 10 — Navigation & Branding Polish

**User Story:** As a user, I want the global navigation to feel like a luxury hotel lobby — refined, calm, and inviting — not cluttered or tech-bro.

#### Acceptance Criteria

1. WHEN the desktop nav renders at scroll-top, THEN it SHALL be slightly transparent with backdrop blur, NOT solid black, so the page hero shows through the edge.
2. WHEN the user scrolls, THEN the nav SHALL transition smoothly to a more opaque state with a hairline bottom border (≤300ms).
3. WHEN a nav item is active, THEN it SHALL show a 2px underline in gold accent AND a subtle glow on the icon, NOT a filled background pill (the current treatment is fine but the color must be gold not pink).
4. WHEN a dropdown opens (Tools, Reference, Profile), THEN it SHALL animate in with the page-enter motion preset, use the floating elevation level, and have generous internal padding (≥12px).
5. WHEN the search bar renders in the nav, THEN the cmd+K hint kbd SHALL use a subtle gold border at low opacity and the search icon SHALL pulse gently on focus (single 600ms ease-out cycle, not infinite).
6. WHEN the mobile bottom nav renders, THEN the active item SHALL show a soft gold dot or 2px gold underline (no fill pill) and inactive items SHALL use the warm-neutral mid-gray.
7. WHEN the EPIMETHEUS wordmark renders, THEN it SHALL use the gold gradient (replacing current pink-rose-orange gradient) and the Logo glow SHALL use gold at low intensity.
8. WHEN the floating CommandCenter button renders (bottom-right), THEN it SHALL use the gold gradient with a metallic sheen effect and SHALL NOT pulse infinitely (only on hover).

---

### Requirement 11 — Accessibility Preservation

**User Story:** As a user with accessibility needs, I want the redesign to maintain or improve current accessibility, so I don't lose functionality I rely on.

#### Acceptance Criteria

1. WHEN any text renders on any background in either theme, THEN contrast SHALL meet WCAG AA (4.5:1 body, 3:1 large/UI components).
2. WHEN any interactive element is focused via keyboard, THEN a visible 2px gold ring SHALL appear with 2px offset (already implemented globally — must remain).
3. WHEN any decorative icon renders, THEN it SHALL include `aria-hidden="true"`.
4. WHEN any icon-only button renders, THEN it SHALL include an `aria-label`.
5. WHILE the user has `prefers-reduced-motion: reduce`, THEN all non-essential motion SHALL be disabled (already implemented — must remain).
6. WHEN tap targets render on mobile, THEN they SHALL maintain minimum 44×44px (already implemented via `.tap-target` — must remain).
7. WHEN safe-area utilities are applied (notch, home indicator), THEN they SHALL continue to work after redesign (already implemented — must remain).
8. IF a new component is introduced, THEN it SHALL pass keyboard navigation (Tab, Shift+Tab, Enter, Escape where applicable) AND screen-reader testing for labels and roles before it's considered done.

---

### Requirement 12 — No Regression on Functionality

**User Story:** As a user, I want every existing feature, route, button, and interaction to keep working exactly as before, since this is a visual redesign only.

#### Acceptance Criteria

1. WHEN a phase is delivered, THEN every existing route SHALL load without runtime errors.
2. WHEN a phase is delivered, THEN every existing button, link, form, and modal SHALL trigger the same action as before.
3. WHEN a phase is delivered, THEN data fetching, AI calls, auth, and Supabase interactions SHALL be untouched.
4. WHEN a phase is delivered, THEN `npm run build`, `npm run lint`, and `npm run lint:api` SHALL all pass.
5. IF a redesign change requires touching component logic (e.g., to add a new ARIA attribute or motion variant), THEN the change SHALL be the minimum needed and SHALL be called out in the PR.
6. WHEN existing test files run (`npm run test`), THEN they SHALL pass.

---

### Requirement 13 — Performance Budget

**User Story:** As a user, I want the redesigned app to feel faster and lighter, not heavier, despite the visual upgrade.

#### Acceptance Criteria

1. WHEN the app boots after redesign, THEN initial JS bundle size SHALL not increase by more than 5% over the current baseline. Measure via `npm run build:analyze`.
2. WHEN backdrop-blur is used, THEN it SHALL be applied selectively (cards, modals, nav) and SHALL NOT be applied to large background layers that would tank GPU performance on low-end devices.
3. WHEN motion animations run, THEN they SHALL animate `transform` and `opacity` only (not `width`, `height`, `top`, `left`) for GPU-accelerated paint.
4. IF a new font is added, THEN it SHALL use `font-display: swap` and SHALL be subset to Latin only unless other glyphs are required.
5. WHEN images or large SVGs are introduced as decorative elements, THEN they SHALL be optimized (SVG cleaned, raster compressed) and lazy-loaded where below the fold.

---

## Correctness Properties

These properties must hold across the entire app after every phase ships:

1. **Token Source-of-Truth:** No raw color hex, no raw font-size px, no raw radius/shadow value appears in any component file outside `index.css`. All visual values reference tokens.
2. **Theme Symmetry:** Every token defined in dark theme has a corresponding light-theme value, and vice versa. Switching themes never produces a missing-color glitch.
3. **Contrast Floor:** Every text/background pair in either theme passes WCAG AA. Verified via automated tooling (e.g., axe DevTools, manual contrast checks for accent-on-base).
4. **Reduced-Motion Honor:** When `prefers-reduced-motion: reduce` is set, no element animates beyond opacity transitions ≤10ms. Holds across every phase.
5. **Keyboard Reachability:** Every interactive element is reachable via Tab, has a visible focus ring, and responds to Enter/Space appropriately.
6. **Functional Parity:** For every route, the same user actions produce the same outcomes as before the redesign.

---

## Risks & Open Questions

The following items need owner input before or during the design phase. They do **not** block writing the spec but **do** block Phase 1 implementation:

1. **Q1 — Accent color final pick:** champagne gold (`#E8C77E`), antique gold (`#D4AF37`), rose gold (`#B76E79`), or platinum/silver (`#C0C0C0` family)? **Recommendation:** champagne gold for warmth + uniqueness.
2. **Q2 — Base depth:** keep the current near-black (`#0a0508`) slightly warmed, or shift to a deeper midnight navy (`#0E1119`)? **Recommendation:** warmed near-black to preserve the "mystic" identity.
3. **Q3 — Serif headlines reach:** apply Cormorant Garamond to all H1/H2 globally, or only on hero/marketing sections (Home, Login)? **Recommendation:** all H1/H2 globally, sans on H3 and below.
4. **Q4 — Phase 1 deliverable scope:** include ONLY the token + utility class swap (fastest, ~1–2 days), OR include token swap PLUS the navigation polish (slightly larger, ~3–4 days)? **Recommendation:** token + utilities first, ship, then nav polish as Phase 2 for cleaner review.
5. **Q5 — Light theme priority:** is light theme actively used by the audience, or is dark the primary canvas? Affects how much polish goes into light mode in each phase.

---

## Phase 1 — Recommended Scope (What to Ship First)

Based on the requirements above, **Phase 1** is the **token + utility class swap in `src/index.css`**:

- **What's in:** Update `@theme` colors (mystic base + accents), update `.light-theme` overrides, update `.glass-card`, `.accent-gradient`, `.text-gradient`, `.mystic-gradient`, `.glow-accent`, `.shimmer-effect`, scrollbar, selection, focus ring, atmosphere gradient.
- **What's out:** No page edits, no component edits, no motion changes yet.
- **Why first:** Single file change. Existing code consumes these via Tailwind classes and CSS variables, so the whole app gets a new look immediately. Lowest risk, highest visible impact, easiest to revert if the direction needs adjustment.
- **Definition of done:**
  - All four open Q1–Q4 questions answered
  - `npm run build` passes
  - Manual smoke-test of Home, Profile, Advisor, Calibration pages confirms new look applies
  - Contrast spot-check on body text, accent buttons, and nav items passes WCAG AA
  - Light theme spot-checked
- **Estimated effort:** 1 working day after questions are answered.
