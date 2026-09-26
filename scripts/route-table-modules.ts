/// <reference lib="dom" />
/**
 * Prints the route table that api/_index.ts actually mounts, straight from the
 * declarative `routes` array. Run with:
 *
 *   npx tsx scripts/route-table-modules.ts
 *
 * Diff its output against `node scripts/route-table.mjs --express <baseline>`
 * to prove the refactor preserved the URL surface and registration order.
 */
import { routes, routesByModule, UNSERVED_DOMAINS } from '../api/lib/handlers/index.js';

for (const route of routes) {
  console.log(`${route.method} ${route.path}`);
}

console.error('--- counts by module ---');
for (const [name, table] of Object.entries(routesByModule)) {
  console.error(`${name.padEnd(12)} ${table.length}`);
}
console.error(`total        ${routes.length}`);
console.error('--- declared-but-unserved domains ---');
for (const name of Object.keys(UNSERVED_DOMAINS)) console.error(name);
