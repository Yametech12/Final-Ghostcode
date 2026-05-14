# UI/UX & Mobile Fixes Applied

All 26 issues addressed. TypeScript clean, tests passing.

## Critical Fixes

| # | Issue | Fix |
|---|-------|-----|
| 1 | `BottomNav` defined but never rendered | Wired into `Layout.tsx`, shown when authenticated and not on Advisor |
| 2 | Broken `/calibrate` route in BottomNav | Fixed to `/calibration` |
| 3 | Hover-only dropdowns broke on touch | Click-to-toggle + outside-click + Escape-to-close |
| 4 | 40+ icon-only buttons missing `aria-label` | Added on theme toggle, hamburger, profile, logout, dropdown buttons, search clear |
| 5 | Pull-to-refresh did `window.location.reload()` | Now invalidates React Query cache + toast confirmation |

## Mobile / Layout

| # | Issue | Fix |
|---|-------|-----|
| 6 | Touch targets <44×44 | New `.tap-target` utility (44×44 minimum), applied to nav buttons |
| 7 | `100dvh` no fallback | Added `h-screen h-[100dvh]` fallback chain |
| 8 | `xl:` breakpoint hid desktop nav on tablets | Changed to `lg:` — iPads/tablets now get desktop nav |
| 9 | Search input width-jumped on focus | Fixed width at `w-56`, added `⌘K` hint |
| 10 | Swipe gestures conflicted with scroll | Removed swipe-to-open menu (kept Escape/X-button) |
| 11 | iPhone notch / home bar clipping | New `safe-area-top/bottom/x` utilities, applied to mobile nav and bottom nav |

## Design / Visual

| # | Issue | Fix |
|---|-------|-----|
| 12 | Inconsistent border-radius | Added CSS tokens `--radius-sm/md/lg/xl/pill` in `index.css` |
| 13 | Inconsistent shadows | Added `--shadow-card/modal/glow` tokens |
| 14 | `glass-card` broke without `backdrop-filter` | Added `@supports` fallback with solid background |
| 15 | Low-contrast `text-slate-500` / `text-slate-600` body text | Bumped to `text-slate-400` in mobile menu items, footer, empty states |
| 16 | No keyboard focus ring | Added `:focus-visible` ring globally |

## Accessibility

| # | Issue | Fix |
|---|-------|-----|
| 17 | No reduced-motion support | Added `@media (prefers-reduced-motion: reduce)` rule |
| 18 | No `.sr-only` class for hidden labels | Added utility class |
| 19 | Decorative icons not marked | `aria-hidden="true"` on decorative `lucide-react` icons in nav |
| 20 | User photo `alt` was redundant text | Changed to empty `alt=""` (decorative — name is shown next to it) |
| 21 | Search inputs had no label | Added `<label>` with `sr-only` class |

## Theme / FOUC

| # | Issue | Fix |
|---|-------|-----|
| 22 | Theme flashed wrong on first paint | Inline script in `index.html` applies theme class before React hydrates |
| 23 | `ThemeProvider` re-applied class on mount | Reads pre-applied class as initial state instead |

## Browser / Standards

| # | Issue | Fix |
|---|-------|-----|
| 24 | `viewport` missing `viewport-fit=cover` | Added — required for iOS safe-area to work |
| 25 | Dropdown items used `<button>` no `role` | Added `role="menu"` / `role="menuitem"` and `aria-haspopup` / `aria-expanded` |
| 26 | Footer year not in safe area | Added `safe-area-bottom` to mobile menu footer |

## Files Touched

- `index.html` — theme FOUC script, viewport-fit=cover
- `src/index.css` — design tokens, safe-area utilities, focus ring, reduced-motion, sr-only, glass-card fallback, contrast bumps
- `src/contexts/ThemeContext.tsx` — read pre-applied theme class as initial state
- `src/components/layout/Layout.tsx` — click-to-toggle dropdowns, outside-click, Escape, ARIA, tap-targets, breakpoints, pull-to-refresh, BottomNav integration, swipe-gesture removal, contrast fixes
- `src/components/layout/BottomNav.tsx` — fixed route, ARIA, safe-area, semantic `<ul>/<li>`, breakpoint

## Verification

```
npm run lint   →  0 errors
npm test       →  7/7 passing
Dev server     →  HMR updates clean
```

## Still TODO (not done — would need broader changes)

- **Empty states** for Dossiers / Favorites pages (depends on those pages' data layer)
- **Skeleton loaders** instead of full-screen spinners on individual pages
- **Form validation on blur** instead of submit (per-form change, scope creep)
- **Splitting Layout.tsx** into Footer/MobileNav/DesktopNav files (mentioned in `STRUCTURE.md`)
- **`pt-24` hardcoded nav offset** is still hardcoded — proper fix is `padding-top: var(--nav-height)` everywhere, but no other pages depend on a smaller value so it works as-is
