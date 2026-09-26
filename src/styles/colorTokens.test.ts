/**
 * Token-layer verification.
 *
 * Four guarantees, all derived from the real repository files (no fixtures):
 *
 * 1. **No colour literals outside the token layer.** Scans every
 *    `src/**\/*.{ts,tsx,css}` plus `index.html` and `public/manifest.json`, and
 *    fails if a hex / rgb() / hsl() literal survives outside the allow-list.
 * 2. **The JS mirror cannot drift.** Every entry of `DARK` / `LIGHT` must equal
 *    the value declared in `src/index.css` (aliases resolved through the chain).
 * 3. **Every referenced token exists.** Each name in `COLOR_TOKEN` must be
 *    declared in `src/index.css`, and each `SEMANTIC_ALIASES` entry must point
 *    at the base token the component layer expects.
 * 4. **Contrast stays accessible.** Body-text and status tokens must clear WCAG
 *    AA (4.5:1) in BOTH themes; accent tokens must clear 3:1 (used for large
 *    text, icons and UI chrome only).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { COLOR_TOKEN, DARK, LIGHT, SEMANTIC_ALIASES } from './colorTokens';
import { contrastRatio } from './contrast';

// vitest runs with `environment: 'jsdom'`, where `import.meta.url` is an
// http:// module URL — `fileURLToPath` rejects that. Resolve the repo root from
// the vitest working directory instead (vitest always runs from the project
// root), and fail loudly rather than silently reading the wrong tree.
const REPO_ROOT = resolve(process.cwd());
const INDEX_CSS = join(REPO_ROOT, 'src/index.css');

describe('test environment', () => {
  it('resolves the repository root', () => {
    expect(() => readFileSync(INDEX_CSS, 'utf8')).not.toThrow();
    expect(REPO_ROOT.endsWith('ghostcode-work')).toBe(true);
  });
});

/**
 * Files allowed to contain colour literals.
 * - `src/index.css`             → the token source of truth.
 * - `src/styles/colorTokens.ts` → the documented JS mirror (verified below).
 * - `src/styles/colorTokens.test.ts` → this file (theme labels in describe.each).
 * - `index.html`                → boot-splash token block, parsed before the bundle CSS.
 * - `public/manifest.json`      → PWA contract, cannot reference CSS variables.
 */
const ALLOWED_LITERAL_FILES = [
  'src/index.css',
  'src/styles/colorTokens.ts',
  'src/styles/colorTokens.test.ts',
  'index.html',
  'public/manifest.json',
];

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const STYLE_ATTRIBUTE = /style="[^"]*"/g;

function stripComments(source: string): string {
  // Block comments first, then line comments — but keep `https://…` intact.
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : walk(full);
    return /\.(ts|tsx|css)$/.test(entry) ? [full] : [];
  });
}

function literalOffenders(): string[] {
  const files = [
    ...walk(join(REPO_ROOT, 'src')),
    join(REPO_ROOT, 'index.html'),
    join(REPO_ROOT, 'public/manifest.json'),
  ];

  const offenders: string[] = [];
  for (const file of files) {
    const rel = relative(REPO_ROOT, file).split('\\').join('/');
    if (ALLOWED_LITERAL_FILES.includes(rel)) continue;
    const source = stripComments(readFileSync(file, 'utf8'));
    source.split('\n').forEach((line, index) => {
      if (COLOUR_LITERAL.test(line)) offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
    });
  }
  return offenders;
}

/** Parse `--name: value;` declarations from a CSS region. */
function parseTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const declaration = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(css)) !== null) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const css = readFileSync(INDEX_CSS, 'utf8');
const baseRegion = css.split('.light-theme {')[0];
const lightRegion = css.split('.light-theme {')[1]?.split('\n}')[0] ?? '';
const allTokens = parseTokens(css);
const baseTokens = parseTokens(baseRegion);
const lightTokens = parseTokens(lightRegion);

/** Resolve `var(--x)` chains down to a literal value. */
function resolve(value: string, scope: Record<string, string>): string {
  let current = value.trim();
  for (let depth = 0; depth < 5; depth += 1) {
    const alias = current.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/);
    if (!alias) break;
    current = (scope[alias[1]] ?? baseTokens[alias[1]] ?? '').trim();
  }
  return current;
}

const normalise = (value: string) => value.replace(/\s+/g, ' ').toUpperCase();

/** Effective light-theme value: light override wins, else the base declaration. */
function lightEffective(token: string): string | undefined {
  const raw = lightTokens[token] ?? baseTokens[token];
  if (raw === undefined) return undefined;
  return resolve(raw, { ...baseTokens, ...lightTokens });
}

describe('colour token layer', () => {
  it('keeps every colour literal inside the allow-listed token files', () => {
    expect(literalOffenders()).toEqual([]);
  });

  it('keeps index.html markup free of colour literals', () => {
    const html = readFileSync(join(REPO_ROOT, 'index.html'), 'utf8');
    const styleAttributes = html.match(STYLE_ATTRIBUTE) ?? [];
    expect(styleAttributes.length).toBeGreaterThan(0);
    for (const attribute of styleAttributes) {
      expect(attribute).not.toMatch(COLOUR_LITERAL);
    }
    // The splash markup must consume the boot token layer instead.
    expect(html).toContain('var(--splash-bg)');
    expect(html).toContain('var(--splash-accent)');
    expect(html).toContain('var(--splash-copper)');
  });

  it('declares every token referenced from JavaScript', () => {
    for (const token of Object.values(COLOR_TOKEN)) {
      expect(allTokens[token], `${token} missing from src/index.css`).toBeDefined();
    }
  });

  it('wires the semantic aliases to the base palette', () => {
    for (const [alias, target] of Object.entries(SEMANTIC_ALIASES)) {
      expect(allTokens[alias], `${alias} missing from src/index.css`).toBe(target);
    }
  });

  it('keeps the JS mirror equal to src/index.css (dark theme)', () => {
    for (const [token, value] of Object.entries(DARK)) {
      const resolved = resolve(baseTokens[token] ?? '', baseTokens);
      expect(resolved, `${token} missing from the base @theme block`).not.toBe('');
      expect(normalise(resolved), `${token} drifted`).toBe(normalise(value));
    }
  });

  it('keeps the JS mirror equal to src/index.css (light theme)', () => {
    for (const [token, value] of Object.entries(LIGHT)) {
      const resolved = lightEffective(token);
      expect(resolved, `${token} unresolved in .light-theme`).toBeDefined();
      expect(normalise(resolved as string), `${token} drifted`).toBe(normalise(value));
    }
  });

  describe.each([['dark'], ['light']])('WCAG AA — %s theme', (theme) => {
    const tokens = theme === 'dark' ? DARK : LIGHT;
    const background =
      theme === 'dark'
        ? resolve(baseTokens['--color-mystic-950'], baseTokens)
        : (lightEffective('--color-mystic-950') as string);

    const effective = (token: string) =>
      theme === 'dark'
        ? resolve(baseTokens[token] ?? '', baseTokens)
        : (lightEffective(token) as string);

    it('uses a hex page background so ratios are meaningful', () => {
      expect(background).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it.each([
      '--color-slate-50',
      '--color-slate-100',
      '--color-slate-200',
      '--color-slate-300',
      '--color-status-success',
      '--color-status-warning',
      '--color-status-error',
      '--color-status-info',
    ])('%s clears 4.5:1 on the page background', (token) => {
      const value = effective(token);
      expect(value, `${token} is not declared`).toBeDefined();
      expect(contrastRatio(value, background)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['--color-accent-primary', '--color-accent-secondary'])(
      '%s clears 3:1 (large text / icons / UI chrome)',
      (token) => {
        expect(contrastRatio(effective(token), background)).toBeGreaterThanOrEqual(3);
      },
    );

    it('--color-slate-400 (muted label) clears 3:1', () => {
      expect(contrastRatio(effective('--color-slate-400'), background)).toBeGreaterThanOrEqual(3);
    });

    it('--color-slate-500 (hint/placeholder) clears 3:1', () => {
      expect(contrastRatio(effective('--color-slate-500'), background)).toBeGreaterThanOrEqual(3);
    });

    // Guard against the pre-refactor light theme, where the accent sat at 1.9:1.
    it('is not the old low-contrast value', () => {
      expect(contrastRatio(effective('--color-accent-primary'), background)).toBeGreaterThan(2.5);
    });
  });
});
