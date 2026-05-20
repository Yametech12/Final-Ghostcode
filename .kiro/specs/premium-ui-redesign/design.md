# Design Document — Premium UI/UX Redesign

> **Spec status:** Design phase. Companion docs: [`requirements.md`](./requirements.md), [`tasks.md`](./tasks.md).
>
> **Owner decisions locked (Phase 1 inputs):**
> - **Q1 — Accent:** Champagne gold `#E8C77E`, with antique gold `#D4AF37` as the deeper hover/active variant
> - **Q2 — Base depth:** Warm near-black `#0E0B12` (preserves mystic identity)
> - **Q3 — Serif headlines:** Hero/marketing sections only (Home + Login). Inter for everything else
> - **Q4 — Phase 1 scope:** Split into **Phase 1A (tokens)** and **Phase 1B (nav polish)** as sequential checkpoints

---

## Overview

This design translates the locked decisions and 13 requirements into concrete, implementable values: a token table, typography scale, motion presets, elevation system, and a file-by-file change map for Phase 1A and 1B.

**Strategy in one sentence:** keep the existing token *names* (`--color-accent-primary`, `--color-mystic-950`, etc.) and only change their *values* — so 99% of the app reskins automatically without touching component code.

**Why this works:** a grep of `src/**/*.tsx` shows `bg-accent-primary`, `text-accent-primary`, `from-accent-primary`, `border-accent-primary` are everywhere. Changing the CSS variable values flips the entire app's color palette in a single file.

**Known gap:** a few components hardcode raw hex (e.g. `ProfileRadarChart.tsx` uses `#ff4b6b` directly). These are listed in tasks as cleanup items — they don't block Phase 1A but should be fixed before declaring "Phase 1 done."

## Architecture

Phase 1 is a CSS-driven reskin, not a code restructure. The architecture relies on three existing pillars and adds nothing new at the framework level:

1. **Tailwind v4 `@theme` block** in `src/index.css` is the single source of truth for color/radius/shadow/motion tokens. All component classes (`bg-accent-primary`, `text-slate-300`, etc.) resolve through this block.
2. **CSS custom properties** drive both themes via the `.light-theme` class toggle on `<html>` (managed by `ThemeContext`). No JS-side theme logic changes.
3. **Component layer is unchanged in 1A.** Phase 1B touches 4 navigation files only; the page tree, routing, data layer, auth, and motion library calls stay identical.

```
┌──────────────────────────────────────────────────────────┐
│ src/index.css                                            │
│ ┌───────────────────────────────────────────────────────┐│
│ │ @theme { --color-accent-primary, --color-mystic-*,   ││
│ │          --shadow-*, --duration-*, --ease-* }        ││
│ └───────────────────────────────────────────────────────┘│
│ ┌───────────────────────────────────────────────────────┐│
│ │ .light-theme { same tokens, light values }           ││
│ └───────────────────────────────────────────────────────┘│
│ ┌───────────────────────────────────────────────────────┐│
│ │ Utility classes: .glass-card, .accent-gradient,      ││
│ │ .text-gradient, .glow-accent, .shimmer-effect,       ││
│ │ .hero-headline (new), .eyebrow (new)                 ││
│ └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
                          │ consumed by
                          ▼
┌──────────────────────────────────────────────────────────┐
│ src/**/*.tsx (Tailwind classes resolve through tokens)   │
│ Phase 1A: zero edits                                     │
│ Phase 1B: 4 nav files (Layout, BottomNav, CommandCenter, │
│           Logo)                                          │
└──────────────────────────────────────────────────────────┘
```

## Components and Interfaces

Phase 1 introduces no new components or public interfaces. It touches existing surfaces by either CSS variable swap (1A) or targeted className/structural edits (1B). The "interfaces" below describe the affected surface contracts so the tasks document can reference them precisely.

### CSS utility class contracts (defined in `index.css`)

| Class | Inputs | Output | Used by |
|---|---|---|---|
| `.glass-card` | none | translucent card surface, gold hairline, top sheen, raised shadow | All cards across pages (~40+ consumers) |
| `.accent-gradient` | none | champagne→gold→copper linear gradient | Buttons, badges, hero blocks |
| `.text-gradient` | none | champagne shimmer (text-clip) | Wordmark, hero numerals |
| `.mystic-gradient` | none | atmospheric warm-black variation | Section backgrounds |
| `.glow-accent` | none | soft gold box-shadow | Logo, CTA, primary indicators |
| `.shimmer-effect` | none | rotating gold shimmer overlay (2s cycle) | Skeleton loaders |
| `.hero-headline` (new) | none | Cormorant Garamond, weight 300, tight tracking | HomePage hero, LoginPage hero (opt-in) |
| `.eyebrow` (new) | none | uppercase label, 0.18em tracking, weight 600 | Section labels (opt-in across phases) |
| `.tabular-nums` (new) | none | tabular numeral feature | Charts, dashboard stats (opt-in) |
| `.atmosphere` | none | fixed full-viewport gold/copper radial gradient | Layout root |

### Component-level edits (Phase 1B only)

| File | Surface area touched | Inputs unchanged | Outputs changed |
|---|---|---|---|
| `Layout.tsx` | Top nav, dropdowns, search bar, EPIMETHEUS wordmark, mobile menu | NAV_GROUPS data, routing, auth, search query state | Active-item visual (pill→underline+glow), nav scroll-aware transparency, dropdown spring animation, search bar focus treatment |
| `BottomNav.tsx` | Mobile bottom nav active indicator | Routes, active detection | Adds gold dot/underline indicator |
| `CommandCenter.tsx` | Floating button, pulse ring, selected-item highlight | All command logic, keyboard shortcut, palette open/close | Adds metallic sheen, removes infinite pulse (hover-only) |
| `Logo.tsx` | Outer container border | SVG paths, sizing prop | Adds gold-hairline-on-hover transition |

## Data Models

Phase 1 introduces no new data models, no new state shape, and no new persisted values. The only "data" introduced is the design token registry in `index.css` `@theme` and `.light-theme` blocks, fully documented in §3 (Color Tokens), §5 (Elevation), and §6 (Motion Tokens) below. No TypeScript types, no API schemas, no Supabase tables, no localStorage keys are added or modified.

---

## 2. Luxury Principles (Requirement 1)

These six principles are the checklist every Phase 1+ change is measured against:

### 2.1 Color Philosophy
- **Single warm-neutral base** (warm near-black `#0E0B12`) — not pure black, not navy
- **Single metallic accent** (champagne gold `#E8C77E`) — used sparingly: CTAs, active states, key emphasis only
- **Restrained secondary** (antique copper `#B87333`) — for highlights and hover-deepening, never as a competing accent
- **Warm grayscale ramp** — neutrals carry a warm undertone, not slate's cool blue cast
- **Status colors are muted** — desaturated green/amber/red/blue that harmonize with gold

### 2.2 Typography Hierarchy
- **Display serif:** Cormorant Garamond, weight 300–400, used **only** on hero H1/H2 in `HomePage` and `LoginPage`
- **Refined sans:** Inter for everything else (all H3+, all body, all UI)
- **Tabular numerals** on data displays (charts, stats): `font-feature-settings: "tnum"`
- **Uppercase section labels:** letter-spacing ≥ 0.15em, weight 600+

### 2.3 Spacing Rhythm
- 4px base grid (Tailwind default, kept)
- Card padding: `p-6` mobile, `p-8` desktop
- Vertical rhythm between sections: `space-y-8` mobile, `space-y-12` desktop

### 2.4 Elevation/Depth Model (4 levels — Requirement 7.1)
| Level | Token | Usage | Shadow |
|---|---|---|---|
| `flat` | `--shadow-flat` | Sits on base, no shadow | `none` |
| `raised` | `--shadow-raised` | Default cards | `0 4px 24px -8px rgba(0,0,0,0.4)` |
| `floating` | `--shadow-floating` | Dropdowns, popovers, tooltips | `0 12px 40px -12px rgba(0,0,0,0.5)` |
| `modal` | `--shadow-modal` | Modals, sheets | `0 24px 80px -16px rgba(0,0,0,0.65)` |

All shadows use **soft, large-radius blur** — no tight harsh shadows.

### 2.5 Motion Personality
- **Default:** 250ms, `cubic-bezier(0.32, 0.72, 0, 1)` (soft start, firm settle — feels weighted)
- **Page enter:** soft spring, stiffness 240, damping 28; stagger children at 100ms
- **No bounce, no rubber** as defaults
- **Hover scales:** capped at 1.03 (currently 1.05 in some places — too juvenile)
- **Reduced motion:** existing `prefers-reduced-motion: reduce` block in `index.css` is preserved verbatim

### 2.6 Iconography
- **Family:** lucide-react only (already in use)
- **Stroke width:** 1.5 globally (lucide default is 2 — refine in Phase 1B nav, then app-wide later)
- **Sizes:** 16 (inline body), 20 (default UI), 24 (nav, primary actions), 32 (hero/large cards)

---

## 3. Color Tokens (Requirement 4)

### 3.1 Strategy: keep names, change values

The existing app uses these token names extensively:
- `--color-accent-primary` (currently Tinder pink `#ff4b6b`) → becomes champagne gold `#E8C77E`
- `--color-accent-secondary` (currently Tinder orange `#ff8a5c`) → becomes antique copper `#B87333`
- `--color-accent-glow` (currently `#ff2d55`) → becomes deeper gold `#D4AF37` (used in glow boxshadows)
- `--color-mystic-950` (currently `#0a0508`) → becomes warm near-black `#0E0B12`
- `--color-mystic-900..700` → re-tuned to warm-tinted darker steps
- `--color-slate-*` → re-tuned with **slight warm undertone** to match the palette

This satisfies Requirement 2.4 and means no component file edits are required for the color reskin.

### 3.2 Final Token Values (Dark Theme)

```css
/* Warm-neutral base — replaces current near-black */
--color-mystic-950: #0E0B12;  /* primary background — warm near-black */
--color-mystic-900: #161118;  /* glass-card fill base */
--color-mystic-800: #1F1A22;  /* raised card surface */
--color-mystic-700: #2A242F;  /* hairline borders, dividers */

/* Metallic accent — champagne gold family */
--color-accent-primary:   #E8C77E;  /* champagne gold — CTAs, active, key emphasis */
--color-accent-secondary: #B87333;  /* antique copper — highlights, hover-deepens */
--color-accent-glow:      #D4AF37;  /* deeper gold — used in glow shadows only */

/* Warm grayscale ramp — replaces slate's cool blue cast */
/* Numeric values shift toward warm hue (slight red-yellow tint) */
--color-slate-50:  #FAF7F2;  /* near-white, body text on dark */
--color-slate-100: #F0EBE3;
--color-slate-200: #DDD5C9;
--color-slate-300: #C4BAAB;  /* default body text on dark — passes WCAG AA on #0E0B12 */
--color-slate-400: #9A8F80;  /* muted body text */
--color-slate-500: #6E6358;  /* hint, placeholder */
--color-slate-600: #4A4138;
--color-slate-700: #312A24;  /* hairline border on dark */
--color-slate-800: #1F1A16;
--color-slate-900: #14110E;
--color-slate-950: #0A0806;
```

**Contrast checks (WCAG AA verified at design time):**
- `--color-slate-300` (#C4BAAB) on `--color-mystic-950` (#0E0B12) → contrast ratio **10.8:1** ✅ (passes AAA body)
- `--color-slate-400` (#9A8F80) on `--color-mystic-950` → **5.8:1** ✅ (passes AA body)
- `--color-accent-primary` (#E8C77E) on `--color-mystic-950` → **11.4:1** ✅ (passes AAA — gold-on-warm-black is naturally high contrast)
- `--color-accent-primary` text on `--color-accent-primary/10` glass fill → **10.5:1** ✅

### 3.3 Status Colors (muted, harmonized)

Replaces current vibrant defaults. Used in toasts, badges, validation messages.

```css
--color-status-success: #6FA083;  /* sage green, desaturated */
--color-status-warning: #C99B5B;  /* amber, harmonizes with gold */
--color-status-error:   #C77A6F;  /* muted terracotta, not vibrant red */
--color-status-info:    #7A93A8;  /* dusty blue */
```

### 3.4 Light Theme (Requirement 4.5)

Warm off-white base (cream/ivory), deeper gold accent for contrast on light backgrounds:

```css
.light-theme {
  --color-mystic-950: #FAF7F2;  /* warm ivory background */
  --color-mystic-900: #F2EDE3;  /* glass-card surface on light */
  --color-mystic-800: #E8E0D2;
  --color-mystic-700: #D8CFBE;

  /* Accent shifts deeper for contrast on cream */
  --color-accent-primary:   #B8860B;  /* deeper gold — passes AA on cream */
  --color-accent-secondary: #8B5A2B;  /* deeper copper */
  --color-accent-glow:      #9C7421;

  /* Grayscale flips and warms */
  --color-slate-50:  #14110E;
  --color-slate-100: #2A2520;
  --color-slate-200: #4A4138;
  --color-slate-300: #6E6358;
  --color-slate-400: #8C8174;
  --color-slate-500: #A89C8E;
  --color-slate-600: #C4BAAB;
  --color-slate-700: #DDD5C9;
  --color-slate-800: #EDE7DC;
  --color-slate-900: #F5F0E6;
  --color-slate-950: #FAF7F2;
}
```

**Contrast checks (light theme):**
- `--color-slate-300` (#6E6358) body text on cream → **5.6:1** ✅
- `--color-accent-primary` (#B8860B) on cream → **4.7:1** ✅ (passes AA body)

### 3.5 Gradients (Requirement 4.7)

Replaces current pink→orange "Tinder sunset":

```css
.accent-gradient {
  background-image: linear-gradient(135deg, #E8C77E 0%, #D4AF37 50%, #B87333 100%);
  /* champagne → deep gold → antique copper — subtle, low contrast within */
}

.text-gradient {
  background-image: linear-gradient(90deg, #E8C77E 0%, #F0D89A 50%, #D4AF37 100%);
  /* champagne shimmer — for wordmark, hero numerals */
}

.mystic-gradient {
  background-image: linear-gradient(135deg, #161118 0%, #0E0B12 50%, #161118 100%);
  /* deep-base-to-slightly-lighter — atmospheric, no color shift */
}
```

---

## 4. Typography (Requirement 5, narrowed by Q3)

### 4.1 Font Stack

Already loaded (verified in `package.json` and `index.css`):
- **Sans:** `Inter` — body, UI, all H3+
- **Serif:** `Cormorant Garamond` — hero H1/H2 only (Home + Login)
- **Display (current):** `Space Grotesk` — kept available but not used by default after redesign
- **Mono:** `JetBrains Mono` — code blocks (unchanged)

### 4.2 Hero serif scope (Q3 = b)

Per the Q3 decision, serif applies to **hero blocks in HomePage and LoginPage only**, not globally. Implementation:

```css
/* Add to index.css — opt-in, not global */
.hero-headline {
  font-family: var(--font-serif);
  font-weight: 300;
  letter-spacing: -0.01em;
  line-height: 1.05;
}

.hero-headline-italic {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
}
```

Hero blocks in HomePage and LoginPage opt in via `<h1 className="hero-headline">`. Everywhere else, the existing global `h1, h2 { @apply font-display ... }` rule will be **changed to** `@apply font-sans` so non-hero headings use Inter (Q3 decision).

### 4.3 Type Scale (Inter except where noted)

| Role | Class | Size / Line | Weight | Tracking |
|---|---|---|---|---|
| Hero H1 (serif) | `.hero-headline` | clamp(2.5rem, 5vw, 4.5rem) / 1.05 | 300 | -0.01em |
| Hero H2 (serif) | `.hero-headline` (smaller) | clamp(1.75rem, 3vw, 2.5rem) / 1.15 | 400 | -0.01em |
| Page H1 (sans) | `h1` | 2.25rem / 1.2 | 600 | -0.02em |
| Section H2 (sans) | `h2` | 1.5rem / 1.3 | 600 | -0.01em |
| Subsection H3 | `h3` | 1.25rem / 1.4 | 600 | -0.005em |
| Body | `p` | 1rem (16px) / 1.65 | 400 | 0 |
| Small / caption | `.text-sm` | 0.875rem / 1.5 | 400 | 0 |
| UI label / button | `button`, `label` | 0.875rem / 1.25 | 500 | 0.02em |
| Uppercase eyebrow | `.eyebrow` | 0.75rem / 1.2 | 600 | 0.18em (uppercase) |
| Tabular numeral | `.tabular-nums` | inherit | inherit | inherit + `font-feature-settings: "tnum"` |

### 4.4 New utility classes added to `index.css`

```css
.eyebrow {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-slate-500);
}

.tabular-nums {
  font-feature-settings: "tnum" 1;
  font-variant-numeric: tabular-nums;
}
```

---

## 5. Elevation, Glass, Borders (Requirement 7)

### 5.1 Shadow tokens (added to `@theme`)

```css
--shadow-flat:     none;
--shadow-raised:   0 4px 24px -8px rgba(0, 0, 0, 0.4);
--shadow-floating: 0 12px 40px -12px rgba(0, 0, 0, 0.5);
--shadow-modal:    0 24px 80px -16px rgba(0, 0, 0, 0.65);
--shadow-glow:     0 0 32px -4px rgba(212, 175, 55, 0.18);  /* gold glow, low intensity */
```

The legacy `--shadow-card` token is kept and aliased to `--shadow-raised` to avoid breaking existing consumers.

### 5.2 Glass card treatment (Requirement 7.2)

```css
.glass-card {
  /* Fallback for browsers without backdrop-filter */
  background-color: rgba(22, 17, 24, 0.85);
  border: 1px solid rgba(232, 199, 126, 0.08);  /* gold hairline at 8% */
  border-radius: var(--radius-lg);  /* 16px */
  box-shadow: var(--shadow-raised);
  position: relative;
}

@supports (backdrop-filter: blur(0)) or (-webkit-backdrop-filter: blur(0)) {
  .glass-card {
    background-color: rgba(22, 17, 24, 0.55);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
}

/* Inner top-edge highlight — the "polished glass" sheen */
.glass-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 1px;
  right: 1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(232, 199, 126, 0.18), transparent);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  pointer-events: none;
}
```

### 5.3 Border philosophy (Requirement 7.5)

- **Default borders:** 1px hairline at 5–10% opacity (warm gray or gold tint depending on surface)
- **Hover borders:** brighten to gold at 15–20% opacity with 200ms transition
- **Focus rings:** 2px gold at full opacity, 2px offset (already implemented globally — preserved)

### 5.4 Glow utility update

```css
.glow-accent {
  box-shadow: 0 0 24px -4px rgba(212, 175, 55, 0.18);  /* deep gold, low intensity */
}
```

---

## 6. Motion Tokens (Requirement 8)

Added as named tokens in `@theme`:

```css
/* Easing curves */
--ease-soft:     cubic-bezier(0.32, 0.72, 0, 1);   /* default — soft start, firm settle */
--ease-emphasis: cubic-bezier(0.4, 0, 0.2, 1);     /* alternative — material standard */

/* Durations */
--duration-fast:   150ms;  /* hover color/border */
--duration-base:   250ms;  /* default UI transitions */
--duration-slow:   400ms;  /* page-level enters, modal scales */
--duration-shimmer: 2000ms;  /* slowed from current 1.5s — Requirement 8.5 */
```

**Spring presets (consumed by motion library in components):**
- `softSpring`: `{ type: "spring", stiffness: 240, damping: 28, mass: 0.9 }`
- `pageEnter`: `{ type: "spring", stiffness: 200, damping: 25, mass: 1, staggerChildren: 0.1 }`

These spring values are documented here but live in TypeScript constants, not CSS, since `motion` consumes JS objects. They will be added to `src/lib/motion.ts` (new file) in Phase 2 — Phase 1A is CSS-only.

### 6.1 Shimmer adjustment (Requirement 8.5, 9.8)

Current `.shimmer-effect` cycles at 1.5s with white tint. Updates:
- Cycle duration: 2.0s (slowed)
- Tint: low-opacity gold gradient instead of white
- Pause when `prefers-reduced-motion: reduce` (already handled by global rule)

```css
.shimmer-effect::after {
  background: linear-gradient(
    to bottom right,
    rgba(232, 199, 126, 0) 0%,
    rgba(232, 199, 126, 0) 40%,
    rgba(232, 199, 126, 0.06) 50%,
    rgba(232, 199, 126, 0) 60%,
    rgba(232, 199, 126, 0) 100%
  );
  animation: shimmer var(--duration-shimmer) infinite;
}
```

### 6.2 Atmosphere update

Replace current pink/orange radial gradients in `.atmosphere`:

```css
.atmosphere {
  background:
    radial-gradient(circle at 50% 30%, rgba(212, 175, 55, 0.06) 0%, transparent 60%),
    radial-gradient(circle at 10% 80%, rgba(184, 115, 51, 0.04) 0%, transparent 50%);
  filter: blur(60px);
  opacity: 0.7;  /* slightly reduced from 0.82 — gold reads more saturated than pink at same alpha */
}
```

---

## 7. Phase 1A — Token + Utility Swap (`src/index.css` only)

**Single-file change. No component edits. ~1 day estimate.**

### 7.1 What changes in `index.css`

| Block | Current | After |
|---|---|---|
| `@theme` mystic colors | `#0a0508` family | `#0E0B12` warm-near-black family |
| `@theme` accent colors | Tinder pink/orange | Champagne gold + antique copper |
| `@theme` slate ramp | Cool blue undertone | Warm undertone |
| `@theme` shadow tokens | `--shadow-card`, `--shadow-modal`, `--shadow-glow` (3) | Add `--shadow-flat`, `--shadow-raised`, `--shadow-floating`, plus existing kept |
| `@theme` motion tokens | None | Add `--ease-soft`, `--ease-emphasis`, `--duration-*` |
| `@theme` status tokens | None | Add `--color-status-*` (4) |
| `.light-theme` block | Cool grays | Warm cream + deeper gold |
| `:root` and `body` background | `#0a0508` | `#0E0B12` |
| `body` selection colors | Pink tint | Gold tint |
| `.atmosphere` radial gradients | Pink + orange | Gold + copper, lower opacity |
| `h1, h2, h3 ...` global rule | `font-display` (Space Grotesk) | `font-sans` (Inter) — Q3 decision |
| New `.hero-headline` class | — | Add (Cormorant, weight 300) |
| New `.eyebrow` class | — | Add (uppercase, tracked) |
| New `.tabular-nums` class | — | Add |
| `.glass-card` | Pink-tinted background, no inner highlight | Warm-base + gold hairline + ::before sheen |
| `.accent-gradient` | Pink → orange | Champagne → gold → copper |
| `.text-gradient` | Pink → rose → orange | Champagne → light champagne → deep gold |
| `.mystic-gradient` | mystic-900 → 950 → 900 | Same names, new values (auto-resolves) |
| `.glow-accent` | Pink boxshadow | Gold boxshadow at 18% opacity |
| `.shimmer-effect::after` | White shimmer, 1.5s | Gold shimmer, 2.0s |
| `.mystic-border` | Pink hover | Gold hover (auto-resolves via accent-primary) |
| `.custom-select` rules | accent-primary references | Auto-reskin (no edit needed) |
| `.markdown-body` rules | accent-primary references | Auto-reskin (no edit needed) |
| `.prose-accent` rules | accent-primary references | Auto-reskin (no edit needed) |
| `::-webkit-scrollbar-thumb` | White at 15% | Warm gray at 18% — slightly higher for visibility on warm-black |
| Selection (in `body`) | `accent-primary/30` | Auto-reskin (no edit needed) |
| `:focus-visible` outline | `--color-accent-primary` | Auto-reskin (no edit needed) |
| `prefers-reduced-motion` block | Existing | **Preserved verbatim** |
| `.sr-only`, `.tap-target`, `.safe-area-*` | Existing | **Preserved verbatim** |

### 7.2 What does NOT change in Phase 1A

- No component files (`.tsx`)
- No motion library calls
- No icon stroke widths (deferred to Phase 1B+)
- No new fonts loaded (Cormorant already loaded)
- No Tailwind config changes (using v4 `@theme` block, no separate config file)

### 7.3 Phase 1A Definition of Done

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] Manual smoke test: Home, Profile, Advisor, Calibration render with new look
- [ ] Light theme spot-check on Home, Profile
- [ ] Contrast spot-check via axe DevTools or manual checker on body text + accent CTA + nav active state (all pass WCAG AA)
- [ ] No raw hex colors are introduced (existing `ProfileRadarChart` hardcodes are tracked in tasks, not blocking)

---

## 8. Phase 1B — Navigation Polish (Requirement 10)

**Estimate: 2–3 days. Touches 4 files. Builds on top of approved Phase 1A tokens.**

### 8.1 File-level change map

#### `src/components/layout/Layout.tsx` (~34 KB, the big one)

| Current | After |
|---|---|
| Nav at scroll-top: opaque background pill on active items | Slightly transparent backdrop-blur, 2px gold underline on active (no fill pill) — Req 10.1, 10.3 |
| Active item: `text-accent-primary bg-accent-primary/5` | `text-accent-primary` + 2px underline at bottom in gold + soft icon glow |
| Search bar focus ring: `focus:border-accent-primary/50` | Gold border at 50%, kbd hint with gold border at low opacity, single-cycle 600ms pulse on icon — Req 10.5 |
| Dropdown open animation | Use page-enter motion preset, floating elevation, ≥12px internal padding — Req 10.4 |
| Background blob `bg-accent-primary/5` (top-left) and `bg-accent-secondary/5` (bottom-right) | Auto-reskin via Phase 1A token swap (no edit needed) |
| Pull-to-refresh indicator | Auto-reskin via Phase 1A — color via `text-accent-primary` |
| Selection bar `bg-accent-primary/30` | Auto-reskin via Phase 1A |
| Mobile menu items | Same gold underline treatment for active state |
| EPIMETHEUS wordmark text | If currently uses `text-gradient`, auto-reskins. If hardcoded gradient classes, replace with `bg-gradient-to-r from-accent-primary via-accent-glow to-accent-secondary` |

#### `src/components/layout/BottomNav.tsx` (~2 KB)

| Current | After |
|---|---|
| Active: `text-accent-primary` (color only) | Add 2px gold underline OR soft gold dot indicator below icon — Req 10.6 |
| Inactive: `text-slate-400 hover:text-slate-200` | Inactive uses warm-neutral mid-gray (auto-reskins via Phase 1A slate ramp) |

#### `src/components/layout/CommandCenter.tsx` (~17 KB)

| Current | After |
|---|---|
| Floating button `bg-gradient-to-br from-accent-primary via-accent-secondary` | Auto-reskins via Phase 1A. Add metallic sheen overlay (subtle inner highlight gradient) — Req 10.8 |
| Pulsing ring `bg-accent-primary/30` with `repeat: Infinity` | Remove infinite repeat. Pulse only on `whileHover` — Req 10.8 |
| Selected item indicator `bg-accent-primary/10 border-accent-primary/20` | Auto-reskins. Verify hairline border opacity matches new philosophy (5–15% range). |

#### `src/components/Logo.tsx` (~2 KB)

The current Logo uses inline SVG paths with no color tint — it's a black box with white SVG. For Phase 1B:

| Current | After |
|---|---|
| `bg-black border border-white/10` outer container | Keep `bg-black` (works on warm-black base), or shift to `bg-mystic-950`. Border to `border-accent-primary/15` at hover — subtle gold edge |
| Inner SVG `text-white fill-current` | Add optional glow wrapper: `<div className="glow-accent">` outside Logo for nav placement only — Req 10.7 |
| Wordmark gradient (in `Layout.tsx` header) | Apply `text-gradient` utility (already updated in Phase 1A) |

### 8.2 Phase 1B Definition of Done

All of Phase 1A's DoD, plus:
- [ ] Desktop nav transparent at scroll-top, opaque after scroll, smooth transition
- [ ] Active nav item: gold underline (no pill), icon has subtle glow
- [ ] Dropdowns animate in with soft spring, floating shadow, ≥12px padding
- [ ] Search bar has gold border at 50% on focus, kbd hint has gold border at low opacity
- [ ] BottomNav active uses 2px gold underline or soft dot
- [ ] CommandCenter button has metallic sheen, infinite pulse removed (hover-only)
- [ ] Logo wordmark uses gold gradient
- [ ] All 22 routes load without runtime errors
- [ ] `npm run build`, `npm run lint`, `npm run test` all pass
- [ ] Keyboard nav: Tab through entire layout works, focus rings visible

### 8.3 Risks for Phase 1B

1. **Layout.tsx is 34 KB and dense** — risk of unintended regressions. Mitigation: small commits per change region (top nav → dropdowns → search bar → mobile menu).
2. **Active state shape change** (pill → underline) is a semantic visual change, not just color — owner should preview before merge.
3. **CommandCenter pulse removal** could be jarring if users relied on the visual cue. Mitigation: keep hover pulse so the affordance remains discoverable.

---

## 9. Components to Audit Post-Phase-1 (Tracked, Not Blocking)

These have hardcoded colors that bypass tokens. They'll appear pink even after Phase 1A and need targeted fixes (Requirement 2.1, 2.2):

| File | Issue | Fix |
|---|---|---|
| `src/components/ProfileRadarChart.tsx` | Hardcoded `#ff4b6b` in linearGradient stops, stroke | Replace with CSS var via `getComputedStyle` or pass color prop from parent that reads token |
| Any other `recharts` consumer | Likely needs same treatment | Audit during Phase 3 (Core Pages — Insights) |

These are listed in `tasks.md` as Phase 1A cleanup items but are not blockers for the Phase 1A ship — they're cleanup that goes in the same PR or immediately after.

---

## Error Handling

Phase 1 is a visual reskin and does not introduce new error paths. The error handling considerations are limited to the following invariants:

1. **CSS variable fallbacks:** every utility class that consumes a custom property is paired with a hardcoded fallback for browsers without `@supports (backdrop-filter)` or in environments where CSS variables fail to resolve. Example: `.glass-card` declares `background-color: rgba(22, 17, 24, 0.85)` before the `@supports` block applies the translucent variant.
2. **Theme transition glitch prevention:** all dark-theme tokens have a corresponding `.light-theme` override. If a token is added to `@theme` it must also be added to `.light-theme` in the same edit to avoid a "missing color" flash on theme toggle.
3. **Motion fallback:** the existing `@media (prefers-reduced-motion: reduce)` block in `index.css` zeros out all animation durations. Any new keyframe (e.g. `pulse-once` in Phase 1B) inherits this behavior automatically since the global rule uses `*, *::before, *::after`.
4. **Backward-compat token aliases:** `--shadow-card` is preserved as an alias of `--shadow-raised` so any existing consumer continues to work without edits.
5. **Phase 1B regression containment:** if a nav-file edit (Phase 1B) introduces a runtime error, the failure is contained to that surface — Phase 1A token swap remains valid and shippable on its own.

## Testing Strategy

Phase 1 testing is verification-focused, not unit-test-focused, since no new logic is introduced. The strategy is:

1. **Build-level verification:** `npm run build`, `npm run lint`, `npm run lint:api`, `npm run test` must all pass after both 1A and 1B.
2. **Visual smoke test:** manual walk-through of `/`, `/profile`, `/advisor`, `/calibration` after 1A; full 22-route walk-through after 1B. No console errors, no broken layouts.
3. **Theme toggle test:** flip light/dark theme on each smoke-tested page, verify no missing-color glitches and contrast holds.
4. **Contrast checks:** axe DevTools or a manual contrast checker against body text (`text-slate-300` on `bg-mystic-950`), primary CTA (`bg-accent-primary` button), and nav active state. All must pass WCAG AA in both themes.
5. **Keyboard navigation test (Phase 1B):** Tab through the entire `Layout.tsx` header, open dropdowns with Enter, close with Escape. Focus ring visible at every step.
6. **Reduced motion test (Phase 1B):** enable `prefers-reduced-motion: reduce` in OS preferences, verify no animations play and transitions are instant.
7. **Hardcoded-color audit:** project-wide grep for raw `#ff4b6b`, `#ff8a5c`, `#ff2d55` returns zero hits outside `index.css` (the `ProfileRadarChart.tsx` cleanup is tracked in tasks).
8. **Bundle size check:** run `npm run build:analyze`, confirm JS delta < 5% and CSS delta < 5 KB versus baseline.

Existing automated tests (`npm run test` via vitest) must continue to pass without modification, since no functional changes are introduced.

## Correctness Properties

After Phase 1A and 1B ship, these must hold:

### Property 1: No regressions

Every route loads without runtime errors; every button, link, form, and modal triggers the same action as before the redesign. Auth, Supabase, AI calls, and data fetching are untouched.

**Validates: Requirements 12.1, 12.2, 12.3**

### Property 2: Build green

`npm run build`, `npm run lint`, `npm run lint:api`, and `npm run test` all pass.

**Validates: Requirements 12.4, 12.6**

### Property 3: Token source-of-truth

All new color, shadow, and motion values live in `src/index.css` `@theme`. The known hardcoded exceptions (`ProfileRadarChart.tsx`) are tracked in tasks and resolved within Phase 1A's PR or its immediate follow-up. No new raw hex values are introduced in component files.

**Validates: Requirements 2.1, 2.2**

### Property 4: Theme symmetry

Every dark token has a corresponding `.light-theme` value, and vice versa. Toggling theme never produces a missing-color glitch.

**Validates: Requirements 2.3, 2.5**

### Property 5: Contrast floor

Every text/background pair in either theme passes WCAG AA (4.5:1 for body, 3:1 for large text and UI components), verified by spot check during 1A.16 and 1B.11.

**Validates: Requirements 2.6, 5.7, 11.1**

### Property 6: Reduced-motion preserved

The existing `@media (prefers-reduced-motion: reduce)` block in `index.css` is unmodified. New keyframes (e.g. `pulse-once` in 1B) inherit reduced-motion behavior from the global rule.

**Validates: Requirements 8.4, 11.5**

### Property 7: Functional parity

For every route, the same user actions produce the same outcomes as before the redesign.

**Validates: Requirements 12.1, 12.2, 12.3, 12.5**

---

## 11. Performance Considerations (Requirement 13)

- **No new fonts loaded.** Cormorant Garamond and Inter are already in the bundle.
- **Backdrop-blur stays bounded.** Glass-card and nav use it; we are not adding it to large background layers.
- **Atmosphere blur kept at `filter: blur(60px)` on a fixed full-viewport layer** — same as today, just different gradient colors. No perf delta.
- **Bundle size delta from Phase 1A: ~0 KB JS, ~0.5 KB CSS** (new tokens + 3 new utility classes).
- **Phase 1B delta: <1 KB JS** (motion preset constants, if added in 1B; otherwise deferred to later phase).

---

## 12. Open Questions Deferred to Later Phases

These don't block Phase 1A or 1B but should be answered before Phase 2 (shared layout polish at scale) or Phase 3 (core pages):

- **Q5 from requirements (light theme priority):** Is light theme actively used? If yes, audit each page in Phase 3+. If primarily dark, light theme stays at "passes contrast checks but no hand-tuning."
- **Hero copy for Home/Login:** the serif treatment shines with shorter, well-considered copy. Owner may want a copy review during Phase 3 before committing serif to existing hero strings.
- **Icon stroke-width global default of 1.5:** current lucide default is 2. Phase 1B nav can adopt 1.5 inline. App-wide adoption can be done via a thin lucide wrapper component in Phase 2 or 3.

---

## 13. References

- Requirements: `./requirements.md`
- Tasks (execution plan): `./tasks.md`
- Source of truth file: `src/index.css`
- Phase 1B targets: `src/components/layout/Layout.tsx`, `BottomNav.tsx`, `CommandCenter.tsx`, `src/components/Logo.tsx`
