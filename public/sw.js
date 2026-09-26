// Epimetheus Service Worker — hand-written (no Workbox), enhanced for offline-first.
//
// Cache versioning: SW_VERSION is a human-readable release marker and BUILD_ID
// is a build hash injected at build time (see scripts/inject-sw-version.mjs).
// Every cache name embeds both; bumping SW_VERSION on every release guarantees
// old hashed assets get evicted instead of being served stale.
//
// The placeholder __SW_VERSION__ is replaced during `npm run build` and at
// dev-server startup. If the placeholder is still present at runtime we fall
// back to a per-deploy timestamp so caching is still safe (just less precise).
//
// Cache strategy map (see docs/architecture/pwa.md):
//   / (shell), /manifest.json, /favicon.svg, icons, /fonts/*.woff2  → precache
//   static assets (js/css/woff2, /assets/*)                         → CacheFirst        (30 entries / 7 days)
//   images (png/jpg/gif/webp/avif/ico/svg)                          → StaleWhileRevalidate (60 entries / 30 days)
//   HTML navigations                                                → NetworkFirst (3s timeout) → /offline.html → cached /
//   /api/*  GET                                                     → NetworkOnly (never cached)
//   /api/*  POST/PATCH/DELETE, cross-origin                         → bypass (default browser handling)
//   /api/billing/*, /api/admin/*, /api/users/me, /api/auth/*        → NEVER cached (explicit allowlist)

const SW_VERSION = 'v3-precache-routes-2026-09-26';
const VERSION_TOKEN = '__SW_VERSION__';
// Build ID: injected hash, or a per-deploy timestamp fallback so caching is
// still safe when the placeholder was never replaced (e.g. dev server).
const BUILD_ID = VERSION_TOKEN.startsWith('__') ? String(Date.now()) : VERSION_TOKEN;

const SHELL_CACHE = `epimetheus-shell-${SW_VERSION}-${BUILD_ID}`;
const OFFLINE_CACHE = `epimetheus-offline-${SW_VERSION}-${BUILD_ID}`;
const STATIC_CACHE = `epimetheus-static-${SW_VERSION}-${BUILD_ID}`;
const IMAGE_CACHE = `epimetheus-images-${SW_VERSION}-${BUILD_ID}`;
const ALL_CACHES = [SHELL_CACHE, OFFLINE_CACHE, STATIC_CACHE, IMAGE_CACHE];
const CACHE_PREFIX = 'epimetheus-';

// Version-sorted newest-first so page-side cleanup (src/lib/sw.ts) and this
// activate handler can keep the lexically-newest cache per kind.
const CACHE_KINDS = ['shell', 'offline', 'static', 'images'];

const OFFLINE_URL = '/offline.html';
const NETWORK_TIMEOUT_MS = 3000;

// Limits for runtime caches.
const STATIC_MAX_ENTRIES = 30;
const STATIC_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IMAGE_MAX_ENTRIES = 60;
const IMAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Response header used to stamp cache insertion time (Cache API has no metadata).
const CACHED_AT_HEADER = 'x-sw-cached-at';

// Endpoints that must NEVER touch the cache — billing, admin, account
// deletion and auth decisions are always fresh from the network.
const NEVER_CACHE_PREFIXES = [
  '/api/billing/',
  '/api/admin/',
  '/api/users/me',
  '/api/auth/',
];

// Assets to pre-cache on install. Fonts: /fonts/*.woff2 are served with a
// 1-year immutable Cache-Control (S9) — list them here when present so they
// are available on the very first offline visit.
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  OFFLINE_URL,
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
];
const PRECACHE_FONTS = [
  // '/fonts/inter-latin-400.woff2',
  // '/fonts/space-grotesk-latin-600.woff2',
];

// Install: pre-cache critical assets (per-entry catch so one 404 doesn't
// abort the whole precache), then activate immediately so a new SW doesn't
// sit in "waiting" state behind an old one.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await Promise.all(
        PRECACHE_ASSETS.map((asset) =>
          shell.add(asset).catch((err) => {
            console.warn(`[SW] Pre-cache failed for ${asset}:`, err);
          })
        )
      );
      // offline.html gets its own versioned cache so it is always the fresh
      // version for THIS SW release — never a stale shell entry.
      const offline = await caches.open(OFFLINE_CACHE);
      await offline.add(OFFLINE_URL).catch((err) => {
        console.warn('[SW] Pre-cache failed for offline.html:', err);
      });
      // Fonts are best-effort precache — missing files just log a warning.
      if (PRECACHE_FONTS.length > 0) {
        await Promise.all(
          PRECACHE_FONTS.map((font) =>
            shell.add(font).catch((err) => {
              console.warn(`[SW] Font pre-cache failed for ${font}:`, err);
            })
          )
        );
      }
    })()
  );
  self.skipWaiting();
});

// Activate: clean up old caches whose name doesn't match the current version.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && !ALL_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for explicit skipWaiting messages from the page so users who
// accept the "new version available" prompt get the new SW activated
// immediately instead of after the next navigation.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- helpers ----------------------------------------------------------------

// Network fetch with a hard timeout so a hanging server doesn't block
// navigation fallback for more than NETWORK_TIMEOUT_MS.
function timeoutFetch(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SW network timeout')), ms);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Cache API responses are immutable and carry no timestamps, so we wrap each
// cached body in a new Response with an insertion-time header. Expiration =
// entry count trim + age check on read.
async function putWithTimestamp(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, String(Date.now()));
  const body = await response.clone().arrayBuffer();
  const stamped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await cache.put(request, stamped);
}

async function isExpired(response, maxAgeMs) {
  if (!response) return false;
  const at = Number(response.headers.get(CACHED_AT_HEADER));
  if (!at) return false; // unstamped (pre-v3) entries are treated as fresh
  return Date.now() - at > maxAgeMs;
}

// Delete oldest entries (Cache keys() preserves insertion order) beyond cap.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

// CacheFirst: hashed/static assets + fonts. A cache hit is always safe for
// content-hashed URLs; age check guards the non-hashed ones.
async function cacheFirst(request, cacheName, maxEntries, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached && !(await isExpired(cached, maxAgeMs))) return cached;
  if (cached) await cache.delete(request);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await putWithTimestamp(cacheName, request, response);
      await trimCache(cacheName, maxEntries);
    }
    return response;
  } catch (err) {
    if (cached) return cached; // serve expired rather than nothing
    return new Response('Asset unavailable', { status: 503 });
  }
}

// StaleWhileRevalidate: images. Serve cached immediately (if not expired),
// refresh the entry in the background; fall back to expired cache offline.
async function staleWhileRevalidate(request, cacheName, maxEntries, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkUpdate = fetch(request)
    .then((response) => {
      if (response.ok) {
        putWithTimestamp(cacheName, request, response);
        trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => undefined);
  if (cached && !(await isExpired(cached, maxAgeMs))) {
    networkUpdate.catch(() => undefined);
    return cached;
  }
  const fresh = await networkUpdate;
  if (fresh) return fresh;
  if (cached) return cached; // offline: expired is better than nothing
  return new Response('Image unavailable', { status: 503 });
}

// NetworkFirst for HTML navigations: 3s network budget, then offline.html
// (own cache), then cached '/', then a bare 503.
async function networkFirstNavigation(request) {
  try {
    const response = await timeoutFetch(request, NETWORK_TIMEOUT_MS);
    if (response && response.ok) {
      // Keep the latest navigation in the shell cache as the offline
      // fallback for the root path (preserves pre-v3 semantics).
      const clone = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put('/', clone));
    }
    return response;
  } catch (err) {
    const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
    if (offline) return offline;
    const cachedHome = await caches.match('/', { cacheName: SHELL_CACHE });
    if (cachedHome) return cachedHome;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// NetworkFirst for the manifest so a stale manifest never overrides the
// latest icon/theme metadata (preserves pre-v3 semantics).
async function networkFirstManifest(request) {
  try {
    return await timeoutFetch(request, NETWORK_TIMEOUT_MS);
  } catch (err) {
    return (await caches.match(request)) || new Response('Offline', { status: 503 });
  }
}

// --- fetch ------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // POST/PATCH/DELETE bypass the cache entirely.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin requests bypass the cache (GA, Sentry, third parties).
  if (url.origin !== self.location.origin) return;

  // Explicit never-cache endpoints — always the network, never stored.
  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  // API GETs: NetworkOnly. Tier decisions, advisor sessions and feeds must
  // be fresh; caching them risks showing wrong subscription state.
  if (url.pathname.startsWith('/api')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigations.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Manifest: network-first (see networkFirstManifest).
  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirstManifest(request));
    return;
  }

  // Static assets: CacheFirst with expiration (30 entries / 7 days).
  if (
    /\.(js|css|woff2?)$/.test(url.pathname) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, STATIC_MAX_ENTRIES, STATIC_MAX_AGE_MS));
    return;
  }

  // Images: StaleWhileRevalidate with expiration (60 entries / 30 days).
  if (/\.(png|jpe?g|gif|webp|avif|ico|svg)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, IMAGE_MAX_ENTRIES, IMAGE_MAX_AGE_MS));
    return;
  }

  // Anything else: default browser handling.
});
