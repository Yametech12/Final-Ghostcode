#!/usr/bin/env node
/**
 * SEC-13: upload build sourcemaps to Sentry and associate them with the
 * deployed release, then delete the local copies ('hidden' maps are never
 * referenced by the bundles, but we don't want them in the deploy output
 * at all).
 *
 * Runs as part of `npm run build` only when the required secrets exist.
 * No-op everywhere else, so local builds and unconfigured deploys don't
 * fail or slow down.
 *
 * Required env (Vercel project settings or CI secrets):
 *   SENTRY_AUTH_TOKEN   — org auth token (sourcemaps write permission)
 *   SENTRY_ORG          — Sentry org slug
 *   SENTRY_PROJECT      — Sentry project slug
 *
 * Release id resolution must match vite.config.ts / sentryNode.ts exactly:
 *   SENTRY_RELEASE || VERCEL_GIT_COMMIT_SHA || GITHUB_SHA
 */

import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets');

const release =
  process.env.SENTRY_RELEASE ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  '';

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;

// eslint-disable-next-line no-console -- CLI script; console is the interface
function log(msg) {
  console.log(`[sourcemaps] ${msg}`);
}

async function hasMaps(dir) {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.map'));
  } catch {
    return [];
  }
}

async function main() {
  if (!release) {
    log('No release id (SENTRY_RELEASE/VERCEL_GIT_COMMIT_SHA/GITHUB_SHA) — skipping.');
    return;
  }
  if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
    log('SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT not set — skipping upload.');
    return;
  }

  const maps = await hasMaps(DIST_ASSETS);
  if (maps.length === 0) {
    log('No sourcemaps found in dist/assets — skipping.');
    return;
  }

  log(`Uploading ${maps.length} sourcemaps for release ${release.slice(0, 12)}…`);

  // Use the Sentry webpack-native CLI via npx to avoid a hard dependency:
  // `sentry-cli sourcemaps inject` rewrites bundle refs (needed because
  // 'hidden' omits them), then `upload` pushes the maps.
  const baseArgs = [
    'sentry-cli',
    '--auth-token', SENTRY_AUTH_TOKEN,
  ];
  try {
    execFileSync('npx', [
      ...baseArgs,
      'sourcemaps', 'inject', '--org', SENTRY_ORG, '--project', SENTRY_PROJECT,
      '--release', release,
      DIST_ASSETS,
    ], { stdio: 'inherit' });
    execFileSync('npx', [
      ...baseArgs,
      'sourcemaps', 'upload', '--org', SENTRY_ORG, '--project', SENTRY_PROJECT,
      '--release', release,
      DIST_ASSETS,
    ], { stdio: 'inherit' });
    log('Upload complete.');
  } catch (err) {
    // Non-fatal: a failed upload must never break the deploy.
    log(`Upload failed (non-fatal): ${err?.message || err}`);
    return;
  }

  // Remove the local maps — they're uploaded and 'hidden' anyway.
  for (const m of maps) {
    await rm(join(DIST_ASSETS, m), { force: true });
  }
  log('Local .map files removed from dist.');
}

main();
