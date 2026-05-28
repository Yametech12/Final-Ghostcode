// Epimetheus Service Worker
// Provides offline caching and enables PWA installability.
//
// Cache versioning: the cache name is suffixed with a build hash injected
// at build time (see scripts/inject-sw-version.mjs). Bumping the suffix on
// every deploy guarantees old hashed assets get evicted instead of being
// served stale to returning users.
//
// The placeholder __SW_VERSION__ is replaced during `npm run build` and at
// dev-server startup. If the placeholder is still present at runtime we fall
// back to a per-deploy timestamp so caching is still safe (just less precise).

const VERSION_TOKEN = '__SW_VERSION__';
const RUNTIME_VERSION =
  VERSION_TOKEN.startsWith('__') ? String(Date.now()) : VERSION_TOKEN;
const CACHE_NAME = `epimetheus-${RUNTIME_VERSION}`;
const CACHE_PREFIX = 'epimetheus-';
const OFFLINE_URL = '/';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: pre-cache critical assets, then activate immediately so a new
// SW doesn't sit in "waiting" state behind an old one.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches whose name doesn't match the current version.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
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

// Fetch: network-first for navigation + manifest, cache-first for hashed
// static assets. Hashed asset names change on every deploy so cache-first
// is safe — they're effectively immutable.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Always go to the network for API calls and cross-origin requests.
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) return;

  // Network-first for navigation requests AND the manifest (so a stale
  // manifest doesn't override the latest icon/theme).
  const isNavigation = request.mode === 'navigate';
  const isManifest = url.pathname === '/manifest.json';
  if (isNavigation || isManifest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update the cache with the fresh navigation response so we have
          // a usable offline fallback.
          if (response.ok && isNavigation) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, clone));
          }
          return response;
        })
        .catch(() => caches.match(isNavigation ? OFFLINE_URL : request) ||
          new Response('Offline', { status: 503 }))
    );
    return;
  }

  // For hashed static assets: cache-first, then network. Hashed filenames
  // mean the URL itself changes between deploys, so a cache hit is always
  // safe to serve.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => new Response('Asset unavailable', { status: 503 }));
    })
  );
});
