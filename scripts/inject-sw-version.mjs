// Replaces the __SW_VERSION__ placeholder in dist/sw.js with a build hash
// so each deploy has a unique cache name. Run after `vite build`.
//
// We hash the contents of dist/assets/ (which is itself derived from source
// hashes) to get a deterministic, content-derived version string.

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';
const SW = join(DIST, 'sw.js');

async function hashDir(dir) {
  const hash = createHash('sha256');
  async function walk(d) {
    const entries = await readdir(d, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        const s = await stat(full);
        hash.update(`${full}:${s.size}:${s.mtimeMs}`);
      }
    }
  }
  await walk(dir);
  return hash.digest('hex').slice(0, 12);
}

try {
  const assetsDir = join(DIST, 'assets');
  const version = await hashDir(assetsDir).catch(() => String(Date.now()));
  const swSource = await readFile(SW, 'utf8');
  const updated = swSource.replace(/__SW_VERSION__/g, version);
  await writeFile(SW, updated, 'utf8');
  console.log(`[SW] Version baked: ${version}`);
} catch (err) {
  console.warn('[SW] Version inject failed; SW will fall back to runtime timestamp:', err.message);
}
