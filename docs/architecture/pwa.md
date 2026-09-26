# PWA / Offline-First Architecture

> Last verified: 2026-09-26 (commit `37c2505f487fd1d43ab73eb7ec3d909767e7546f` + PWA enhancement patch)

Epimetheus uses a **hand-written service worker** (`public/sw.js`) — no Workbox, no `vite-plugin-pwa`. The SW is copied verbatim by Vite from `public/` to `dist/` (exact path `dist/sw.js`, unhashed), and a build hash is injected into it after the bundle step by `scripts/inject-sw-version.mjs`.

## 1. Cache strategy per endpoint

| Request type | Strategy | Cache | Limits |
|---|---|---|---|
| `/` (app shell), other HTML navigations | **NetworkFirst** with 3 s timeout | `epimetheus-shell-*` | falls back → `/offline.html` → cached `/` |
| `/offline.html` | Precache (own cache) | `epimetheus-offline-*` | versioned per SW release — never stale |
| `/manifest.json` | **NetworkFirst** (3 s timeout) | shell cache | stale manifest must never override icons/theme |
| Hashed static assets (`/assets/*.js`, `/assets/*.css`), `*.woff2`, `/favicon.svg` | **CacheFirst** | `epimetheus-static-*` | max 30 entries / 7 days |
| Images (`png jpg gif webp avif ico svg`) | **StaleWhileRevalidate** | `epimetheus-images-*` | max 60 entries / 30 days |
| `/api/*` GET | **NetworkOnly** — never stored | — | tier decisions, advisor sessions, feeds must be fresh |
| `/api/*` POST/PATCH/DELETE | Bypass (default browser handling) | — | — |
| Cross-origin requests | Bypass | — | GA, Sentry, third parties |
| `/api/billing/*`, `/api/admin/*`, `/api/users/me`, `/api/auth/*` | **NEVER cached** (explicit allowlist, checked first) | — | — |

### Precache list (install step)

`/`, `/manifest.json`, `/favicon.svg`, `/offline.html`, `/icon-192.png`, `/icon-512.png`, `/icon-maskable-192.png`, `/icon-maskable-512.png`, plus `/fonts/*.woff2` entries **only if those files exist** (see the `PRECACHE_FONTS` array in `public/sw.js` — S9's self-hosted fonts are not part of the baseline `main` branch; uncomment the entries after the fonts patch is applied). Each precache entry fails independently — one 404 never aborts the shell.

### Expiration implementation

The Cache API stores no metadata, so the SW stamps each stored `Response` with an `x-sw-cached-at` header (`putWithTimestamp`). On read, entries older than the max age are deleted and refetched; after each write the cache is trimmed to its entry cap (oldest first — `cache.keys()` preserves insertion order).

## 2. Cache names & lifecycle

```
epimetheus-shell-{SW_VERSION}-{BUILD_ID}
epimetheus-offline-{SW_VERSION}-{BUILD_ID}
epimetheus-static-{SW_VERSION}-{BUILD_ID}
epimetheus-images-{SW_VERSION}-{BUILD_ID}
```

- `SW_VERSION` — human-readable release marker (`v3-precache-routes-2026-09-26`). **Bump on every release** that changes precache/strategy semantics.
- `BUILD_ID` — content hash injected by `scripts/inject-sw-version.mjs`; if the placeholder survives (dev), it falls back to a timestamp.

Lifecycle:

1. **install** — precache shell + offline (per-entry catch), `skipWaiting()`.
2. **activate** — delete every `epimetheus-*` cache not in the current version set, `clients.claim()`.
3. **message** — `SKIP_WAITING` posted by the page's update prompt.
4. **fetch** — strategy dispatch per the table above (non-GET and never-cache checks run before any strategy).

## 3. Update flow

```
deploy → browser detects new /sw.js → installs (parallel, old SW still controls pages)
       → src/lib/sw.ts detects `registration.waiting` / `updatefound`
       → dispatches window CustomEvent `swUpdated` { detail: { waiting } }
       → <UpdatePrompt/> banner: "New version available — Reload now / Later"
       → Reload now → postMessage({type:'SKIP_WAITING'}) → controllerchange → location.reload()
```

`src/lib/sw.ts` also runs a page-side `cleanupOldCaches()` pass (keeps the lexically-newest cache per kind) for long-lived tabs, and registers **PROD only** (`'serviceWorker' in navigator && import.meta.env.PROD`) so Vite dev HMR is never cached.

## 4. Offline fallback page

`public/offline.html` is served for failed navigations. It:

- mirrors the app token palette for both themes (reads the same `theme` localStorage key `ThemeContext` writes; `html.light-theme` flips to the cream palette),
- shows the Epimetheus logo and an "You're offline" message,
- offers **Try again** (`location.reload()`), auto-reloads on the `online` event,
- offers **"Back to last visited page"** when `document.referrer`'s path is present in any cache (`caches.match(referrer)`).

It lives in its own `epimetheus-offline-*` cache so a stale shell entry can never shadow the fresh fallback.

## 5. Web app manifest

`public/manifest.json` — canonical palette (`#0E0B12` background/theme), `start_url: '/'`, `scope: '/'`, `display: standalone`, `orientation: portrait-primary`, `lang: en`, categories `['productivity', 'lifestyle']`, and four icons: 192/512 `purpose: any` plus 192/512 `purpose: maskable` (real padded PNGs, 0.68 safe-zone).

## 6. Debugging tips

- **Chrome/Edge:** DevTools → Application → Service Workers (check "Update on reload" while iterating), Cache Storage (per-cache inspection), "Bypass for network" to test non-SW behavior.
- **Force an update check:** `navigator.serviceWorker.getRegistration().then(r => r?.update())`.
- **Inspect stamped timestamps:** `caches.open('epimetheus-static-…').then(c => c.keys())` → inspect a `Response`'s `x-sw-cached-at` header.
- **Nuke everything:** Application → Storage → Clear site data.
- **Verify the deployed SW is the built one:** the served `sw.js` must not contain `__SW_VERSION__` in production (`curl -s https://<host>/sw.js | grep __SW_VERSION__` should be empty).
- **Test offline:** DevTools → Network → Offline, then reload — you should land on `offline.html` for uncached routes and still see cached assets load.

## 7. Known limitations

- **HTTPS required** — SW registration works only on `https://` or `localhost`. The Vercel deployment is HTTPS by default; local dev skips registration (PROD-only gate), so `vite preview` on `localhost` is the closest local simulation.
- **Safari/iOS:** storage is partitioned and subject to aggressive 7-day ITP eviction for script-writable storage (including Cache API when the site is not added to the home screen); the iOS install experience ("Add to Home Screen") does not support custom splash screens and maskable icons are approximated. `display: standalone` works, but some Android-only manifest members (`orientation`) are ignored.
- **Edge/brave profiles with SW disabled** or private windows (Firefox): registration silently fails — the app still works, just without offline caching.
- The 3 s navigation timeout is a UX trade-off: a slow-but-alive network may serve `offline.html` for a route that would eventually load. Retry or back-navigation recovers it.
