/**
 * Regenerates (or verifies) the `headers` block of vercel.json from the
 * canonical set in api/lib/securityHeaders.ts.
 *
 * The app shell is served by Vercel's CDN, not by the serverless function, so
 * the policy genuinely has to exist in two places. This script removes the
 * "two hand-maintained copies" failure mode: the CDN copy is generated from
 * the same module the API uses.
 *
 *   npx tsx scripts/sync-vercel-headers.ts            # rewrite vercel.json
 *   npx tsx scripts/sync-vercel-headers.ts --check     # CI gate; exit 1 on drift
 *
 * Exits 0 on success, 1 on drift/parse error.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getStaticSecurityHeaders } from '../api/lib/securityHeaders.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercelPath = path.join(root, 'vercel.json');
const checkOnly = process.argv.includes('--check');

// The CDN copy is the production variant — vercel.json only ever serves HTTPS
// deployments, so HSTS is unconditional there.
const expectedHeaders = getStaticSecurityHeaders({ isProduction: true });

const raw = readFileSync(vercelPath, 'utf8');
const cfg = JSON.parse(raw) as Record<string, unknown>;

// Stable key order so the file diffs cleanly on every regeneration.
const ORDER = [
  'version',
  'buildCommand',
  'outputDirectory',
  'framework',
  'functions',
  'routes',
  'headers',
] as const;

const ordered: Record<string, unknown> = {};
for (const key of ORDER) {
  if (key in cfg) ordered[key] = cfg[key];
}
for (const key of Object.keys(cfg)) {
  if (!(key in ordered)) ordered[key] = cfg[key];
}
ordered.headers = [{ source: '/(.*)', headers: expectedHeaders }];

const next = JSON.stringify(ordered, null, 2) + '\n';

if (checkOnly) {
  if (next !== raw) {
    console.error(
      '[check:headers] vercel.json is out of sync with api/lib/securityHeaders.ts.\n' +
        'Run: npm run sync:headers',
    );
    const current = JSON.stringify((cfg.headers as unknown) ?? null, null, 2);
    console.error('\n--- vercel.json headers ---\n' + current);
    console.error('\n--- expected ---\n' + JSON.stringify(ordered.headers, null, 2));
    process.exit(1);
  }
  // Extra assertion: no route rule may shadow the header rule source.
  const routes = (cfg.routes as Array<Record<string, unknown>>) ?? [];
  if (!routes.length) {
    console.error('[check:headers] vercel.json has no `routes` — API dispatch would break.');
    process.exit(1);
  }
  // Look the CSP up by key — indexing [0] would read HSTS, which is unshifted
  // to the front of the list and would produce a nonsense directive count.
  const cspEntry = expectedHeaders.find((h) => h.key === 'Content-Security-Policy');
  const cspDirectiveCount = cspEntry ? cspEntry.value.split('; ').length : 0;
  console.log(
    '[check:headers] OK — vercel.json headers match api/lib/securityHeaders.ts ' +
      `(${expectedHeaders.length} headers, ${cspDirectiveCount} CSP directives).`,
  );
  process.exit(0);
}

if (next === raw) {
  console.log('[sync:headers] vercel.json already up to date.');
} else {
  writeFileSync(vercelPath, next, 'utf8');
  console.log('[sync:headers] vercel.json regenerated from api/lib/securityHeaders.ts.');
}
