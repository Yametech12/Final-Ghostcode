/**
 * JavaScript mirror of the CSS token layer declared in `src/index.css`.
 *
 * Why this module exists
 * ----------------------
 * CSS custom properties are the single source of truth for colour. A handful of
 * consumers cannot use them directly:
 *
 *  - **SVG presentation attributes.** Recharts writes `stroke` / `fill` as XML
 *    *attributes*, and attributes do not accept `var()`.
 *  - **Canvas / raster exporters.** `html2canvas` and `html-to-image` need a
 *    *resolved* colour string for their `backgroundColor` option.
 *
 * Those call sites read the live value at run time through `readToken()` (or the
 * `useThemeColors()` hook), so a theme flip still flows through to the chart and
 * to the exported PNG.
 *
 * The literal values in `DARK` / `LIGHT` are the only colour literals allowed
 * outside `src/index.css`. They exist so SSR and the very first paint never
 * render an unstyled chart, and `colorTokens.test.ts` asserts they stay equal to
 * the values in `src/index.css` — palette drift fails the test suite.
 */

import { useEffect, useState } from 'react';

/** Base-palette token names consumed from JavaScript. */
export const COLOR_TOKEN = {
  surfacePage: '--color-mystic-950',
  surfaceRaised: '--color-mystic-900',
  borderHairline: '--color-mystic-700',
  accentPrimary: '--color-accent-primary',
  accentSecondary: '--color-accent-secondary',
  chartGrid: '--color-chart-grid',
  slate50: '--color-slate-50',
  slate100: '--color-slate-100',
  slate300: '--color-slate-300',
  slate400: '--color-slate-400',
  slate500: '--color-slate-500',
  statusSuccess: '--color-status-success',
  statusWarning: '--color-status-warning',
  statusError: '--color-status-error',
  statusInfo: '--color-status-info',
} as const;

export type ColorTokenName = (typeof COLOR_TOKEN)[keyof typeof COLOR_TOKEN];

/**
 * Semantic aliases declared in `src/index.css`. Verified by the token test so a
 * component can never reference an alias that quietly stopped existing.
 */
export const SEMANTIC_ALIASES = {
  '--color-surface-page': 'var(--color-mystic-950)',
  '--color-surface-raised': 'var(--color-mystic-900)',
  '--color-surface-sunken': 'var(--color-mystic-950)',
  '--color-border-hairline': 'var(--color-mystic-700)',
} as const;

/**
 * Dark-theme palette values — must equal the base `@theme` declarations in
 * `src/index.css`. `colorTokens.test.ts` enforces the equality.
 */
export const DARK: Record<string, string> = {
  '--color-mystic-950': '#0E0B12',
  '--color-mystic-900': '#161118',
  '--color-mystic-800': '#1F1A22',
  '--color-mystic-700': '#2A242F',
  '--color-accent-primary': '#E8C77E',
  '--color-accent-secondary': '#B87333',
  '--color-chart-grid': 'rgb(255 255 255 / 0.08)',
  '--color-slate-50': '#FAF7F2',
  '--color-slate-100': '#F0EBE3',
  '--color-slate-200': '#DDD5C9',
  '--color-slate-300': '#C4BAAB',
  '--color-slate-400': '#9A8F80',
  '--color-slate-500': '#6E6358',
  '--color-status-success': '#6FA083',
  '--color-status-warning': '#C99B5B',
  '--color-status-error': '#C77A6F',
  '--color-status-info': '#7A93A8',
};

/**
 * Light-theme (`.light-theme`) overrides — must equal the token block in
 * `src/index.css`. Only tokens the light theme actually re-declares are listed.
 */
export const LIGHT: Record<string, string> = {
  '--color-mystic-950': '#FAF7F2',
  '--color-mystic-900': '#F2EDE3',
  '--color-mystic-800': '#E8E0D2',
  '--color-mystic-700': '#D8CFBE',
  '--color-accent-primary': '#B8860B',
  '--color-accent-secondary': '#8B5A2B',
  '--color-chart-grid': 'rgb(20 17 14 / 0.12)',
  '--color-slate-50': '#14110E',
  '--color-slate-100': '#2A2520',
  '--color-slate-200': '#4A4138',
  '--color-slate-300': '#6E6358',
  '--color-slate-400': '#8C8174',
  '--color-slate-500': '#7A6F61',
  '--color-status-success': '#3F6B52',
  '--color-status-warning': '#7A5210',
  '--color-status-error': '#9C3B2E',
  '--color-status-info': '#3A5A73',
};

/** Browser-chrome colour per theme — mirrors `--color-mystic-950`. */
export const THEME_COLOR = {
  dark: '#0E0B12',
  light: '#FAF7F2',
} as const;

/**
 * Read a token's *resolved* value from the document root.
 *
 * Returns `fallback` (or the dark-theme value) when there is no DOM — the CSS
 * variables are not available during SSR or in a non-browser test.
 */
export function readToken(name: string, fallback = DARK[name] ?? ''): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export interface ThemeColors {
  accentPrimary: string;
  accentSecondary: string;
  tickColor: string;
  gridColor: string;
  mutedColor: string;
  surfaceBg: string;
  surfacePage: string;
}

function snapshot(): ThemeColors {
  return {
    accentPrimary: readToken(COLOR_TOKEN.accentPrimary),
    accentSecondary: readToken(COLOR_TOKEN.accentSecondary),
    tickColor: readToken(COLOR_TOKEN.slate400),
    gridColor: readToken(COLOR_TOKEN.chartGrid),
    mutedColor: readToken(COLOR_TOKEN.slate500),
    surfaceBg: readToken(COLOR_TOKEN.surfaceRaised),
    surfacePage: readToken(COLOR_TOKEN.surfacePage),
  };
}

/**
 * Resolved palette that re-reads itself whenever the theme class on `<html>`
 * flips. Replaces the per-component `getCssVar` + `MutationObserver` copies that
 * used to live in the chart components.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(snapshot);

  useEffect(() => {
    const refresh = () => setColors(snapshot());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
