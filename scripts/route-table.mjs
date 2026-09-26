#!/usr/bin/env node
/**
 * Route-table extractor.
 *
 *   node scripts/route-table.mjs --express <file>    # parse app.get/post/... calls
 *   node scripts/route-table.mjs --server  <file>    # parse the Vercel matcher
 *
 * Used by the handlers.ts refactor to prove the mounted surface is unchanged:
 * the pre-refactor table is parsed out of the baseline api/_index.ts (from git)
 * and diffed against the table printed by scripts/route-table-modules.ts.
 */
import { readFileSync } from 'node:fs';

const [, , mode, file] = process.argv;
if (!file) {
  console.error('usage: route-table.mjs --express|--server <file>');
  process.exit(2);
}
const src = readFileSync(file, 'utf8');

if (mode === '--express') {
  const re = /app\.(get|post|put|patch|delete)\(\s*(['"])([^'"]+)\2/g;
  const rows = [];
  for (const m of src.matchAll(re)) rows.push(`${m[1].toUpperCase()} ${m[3]}`);
  console.log(rows.join('\n'));
} else if (mode === '--server') {
  const rows = [];
  for (const line of src.split('\n')) {
    const eq = line.match(/pathname === '([^']+)'\s*&&\s*req\.method === '([A-Z]+)'/);
    if (eq) { rows.push(`${eq[2]} /api/${eq[1]}`); continue; }
    const eqLeft = line.match(/req\.method === '([A-Z]+)'\s*&&\s*pathname === '([^']+)'/);
    if (eqLeft) { rows.push(`${eqLeft[1]} /api/${eqLeft[2]}`); continue; }
    if (/pathname === '(ai\/credits)'/.test(line)) rows.push('GET /api/ai/credits');
  }
  console.log([...new Set(rows)].join('\n'));
} else {
  console.error(`unknown mode ${mode}`);
  process.exit(2);
}
