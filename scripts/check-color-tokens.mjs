#!/usr/bin/env node
/**
 * Design-token guard — `npm run lint:tokens` (warn) / `npm run lint:tokens:strict` (fail).
 *
 * Colour literals belong in the token layer:
 *   - src/index.css                 (CSS custom properties — source of truth)
 *   - src/styles/colorTokens.ts     (JS mirror, for canvas / SVG consumers)
 *   - src/styles/colorTokens.test.ts(expected values in the verification suite)
 *   - index.html                    (boot-splash block, runs before the bundle CSS)
 *   - public/manifest.json          (PWA contract, cannot use CSS variables)
 *
 * Everywhere else must use a semantic utility (bg-surface-raised, shadow-modal,
 * text-status-error, …), `var(--color-…)` inside an inline style, or
 * `color-mix(in srgb, var(--color-…) X%, transparent)`.
 *
 * Exit code: 0 unless --strict is passed and offenders exist.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const STRICT = process.argv.includes('--strict');

const ALLOWED = [
  'src/index.css',
  'src/styles/colorTokens.ts',
  'src/styles/colorTokens.test.ts',
  'index.html',
  'public/manifest.json',
];

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : walk(full);
    return /\.(ts|tsx|css)$/.test(entry) ? [full] : [];
  });
}

const files = [
  ...walk(join(REPO_ROOT, 'src')),
  join(REPO_ROOT, 'index.html'),
  join(REPO_ROOT, 'public/manifest.json'),
];

const offenders = [];
for (const file of files) {
  const rel = relative(REPO_ROOT, file).split('\\').join('/');
  if (ALLOWED.includes(rel)) continue;
  const source = stripComments(readFileSync(file, 'utf8'));
  source.split('\n').forEach((line, index) => {
    if (COLOUR_LITERAL.test(line)) {
      offenders.push({ file: rel, line: index + 1, text: line.trim().slice(0, 120) });
    }
  });
}

const byFile = offenders.reduce((acc, o) => {
  acc[o.file] = (acc[o.file] ?? 0) + 1;
  return acc;
}, {});

console.log('design-token guard — colour literals outside the token layer');
console.log('scanned:', files.length, 'files · allow-listed:', ALLOWED.join(', '));

if (offenders.length === 0) {
  console.log('result: 0 offenders (PASS)');
  process.exit(0);
}

console.log(`result: ${offenders.length} offender(s) in ${Object.keys(byFile).length} file(s)`);
for (const [file, count] of Object.entries(byFile)) {
  console.log(`  ${file} — ${count}`);
}
for (const o of offenders.slice(0, 40)) {
  console.log(`  ${o.file}:${o.line}  ${o.text}`);
}
console.log(
  STRICT
    ? '\nstrict mode: failing. Move the value into src/index.css and use a token.'
    : '\nwarn-only (run with --strict in CI to gate).',
);

process.exit(STRICT ? 1 : 0);
