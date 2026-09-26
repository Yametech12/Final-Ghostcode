#!/usr/bin/env node
/**
 * Counts colour literals in a source tree, for the before/after table of the
 * token refactor. Mirrors the semantics of scripts/check-color-tokens.mjs but
 * reports raw occurrence counts instead of offender lines.
 *
 *   node scripts/count-color-literals.mjs <root>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const ALLOWED = [
  'src/index.css',
  'src/styles/colorTokens.ts',
  'src/styles/colorTokens.test.ts',
  'index.html',
  'public/manifest.json',
];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNC = /\b(?:rgba?|hsla?)\(/g;

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return e === 'node_modules' ? [] : walk(full);
    return /\.(ts|tsx|css)$/.test(e) ? [full] : [];
  });
}

const files = [
  ...walk(join(root, 'src')),
  join(root, 'index.html'),
  join(root, 'public/manifest.json'),
];

let hex = 0;
let func = 0;
const perFile = {};
let scanned = 0;

for (const file of files) {
  const rel = relative(root, file).split('\\').join('/');
  if (ALLOWED.includes(rel)) continue;
  let source;
  try {
    source = stripComments(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  scanned += 1;
  const h = (source.match(HEX) ?? []).length;
  const f = (source.match(FUNC) ?? []).length;
  if (h + f > 0) perFile[rel] = { hex: h, rgba: f };
  hex += h;
  func += f;
}

console.log(`root: ${root}`);
console.log(`files scanned (token-layer files excluded): ${scanned}`);
console.log(`hex literals: ${hex}`);
console.log(`rgb/rgba/hsl/hsla literals: ${func}`);
console.log(`total colour literals: ${hex + func}`);
for (const [file, c] of Object.entries(perFile).sort((a, b) => b[1].hex + b[1].rgba - (a[1].hex + a[1].rgba))) {
  console.log(`  ${file} — hex ${c.hex}, rgba ${c.rgba}`);
}
