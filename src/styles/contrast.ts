/**
 * Minimal WCAG 2.1 contrast maths used by the token test suite.
 *
 * Kept dependency-free and DOM-free so it can run against the values parsed
 * straight out of `src/index.css` in a Node/jsdom test environment.
 */

export type Rgb = [number, number, number];

/** Parse `#rgb`, `#rrggbb` (and the 4/8-digit alpha forms, alpha ignored). */
export function parseHexColor(input: string): Rgb | null {
  const value = input.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const long = /^#([0-9a-fA-F]{6})$/;
  const shortWithAlpha = /^#([0-9a-fA-F]{4})$/;
  const longWithAlpha = /^#([0-9a-fA-F]{8})$/;

  let hex: string | null = null;
  const shortMatch = value.match(short);
  const shortAlphaMatch = value.match(shortWithAlpha);
  const longMatch = value.match(long);
  const longAlphaMatch = value.match(longWithAlpha);

  if (shortMatch) hex = shortMatch[1].split('').map((c) => c + c).join('');
  else if (shortAlphaMatch) hex = shortAlphaMatch[1].slice(0, 3).split('').map((c) => c + c).join('');
  else if (longMatch) hex = longMatch[1];
  else if (longAlphaMatch) hex = longAlphaMatch[1].slice(0, 6);

  if (!hex) return null;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours (1 — 21). */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) {
    throw new Error(`contrastRatio expects hex colours, received: ${foreground} / ${background}`);
  }
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
