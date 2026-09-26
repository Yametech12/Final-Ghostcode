/**
 * CANONICAL security-header set — the single source of truth for BOTH:
 *
 *   1. api/lib/http.ts            → runtime headers on every Express (:3000)
 *                                   and Vercel serverless (/api/*) response.
 *   2. vercel.json "headers"      → CDN-level headers on the static app shell
 *                                   (/, /index.html, /assets/*, PWA files),
 *                                   which never pass through the function.
 *
 * Why this module exists: previously the CSP/HSTS only lived in http.ts, so the
 * HTML document users actually load shipped with NO Content-Security-Policy,
 * NO Strict-Transport-Security and NO X-Frame-Options. Meanwhile the policy in
 * http.ts had to be kept in sync with a second copy in vercel.json by hand —
 * exactly the kind of drift that silently re-opens the hole.
 *
 * `scripts/sync-vercel-headers.ts` regenerates vercel.json from this file and
 * `--check` fails CI when the two diverge. The production value of
 * getStaticSecurityHeaders({ isProduction: true }) MUST equal the vercel.json
 * value byte-for-byte: identical duplicates are harmless (a browser intersects
 * two identical policies into the same policy), divergent ones are not.
 *
 * Do NOT import anything here. This file must stay dependency-free so the sync
 * script can read it without pulling in @vercel/node.
 */

/** HSTS: 1 year, subdomains, preload-eligible. Only ever sent over HTTPS. */
export const HSTS_VALUE = 'max-age=31536000; includeSubDomains; preload';

export const X_FRAME_OPTIONS_VALUE = 'DENY';
export const X_CONTENT_TYPE_OPTIONS_VALUE = 'nosniff';
export const REFERRER_POLICY_VALUE = 'strict-origin-when-cross-origin';
export const PERMISSIONS_POLICY_VALUE = 'camera=(), microphone=(), geolocation=()';

/**
 * Outbound fetch destinations (fetch/XHR/WebSocket/EventSource):
 *   • Supabase REST, Storage, Auth          → https://*.supabase.co
 *   • Supabase Realtime (wss upgrade)       → wss://*.supabase.co
 *   • Regolo AI (server-side; kept allowed
 *     so a future direct client call works) → https://api.regolo.ai
 *   • Sentry browser ingest (regional)      → *.ingest.{,de.,us.}sentry.io
 *   • Google Analytics measurement protocol → www./*.google-analytics.com
 *   • gtag.js loader fetch                  → www.googletagmanager.com
 *   • blob: — browser-image-compression / the image cropper round-trip
 *     object URLs through fetch(); without blob: the upload path breaks.
 */
const CONNECT_SRC_PROD = [
  "'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'https://api.regolo.ai',
  'https://*.ingest.sentry.io',
  'https://*.ingest.de.sentry.io',
  'https://*.ingest.us.sentry.io',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://www.googletagmanager.com',
  'blob:',
].join(' ');

/**
 * Dev-only additions. The Express dev server applies this CSP to /api/*
 * responses (and to `dist` when it serves the built app locally at
 * http://localhost:3000). Without these, HMR sockets and the vite-proxied
 * fetches are killed by connect-src. Never present in the production value.
 */
const CONNECT_SRC_DEV_EXTRA =
  "ws://localhost:* ws://127.0.0.1:* http://localhost:5173 http://localhost:5174 http://localhost:3000";

/**
 * Directive list. Order is stable and is asserted by the sync script, so the
 * generated vercel.json value and the runtime value are the same string.
 *
 * Notes on the two choices that deviate from a naive default:
 *   • frame-ancestors 'none'  ← matches X-Frame-Options: DENY. Using
 *     frame-ancestors 'self' next to DENY is contradictory: browsers that
 *     understand CSP ignore XFO, so 'self' would silently *loosen* the policy
 *     to allow same-origin framing while the XFO header claims otherwise.
 *   • script-src has NO 'unsafe-inline' and no nonce: every script must be an
 *     external same-origin file. This is what forced public/theme-bootstrap.js
 *     (the old inline theme snippet would have been blocked → FOUC).
 *   • style-src keeps 'unsafe-inline': Tailwind 4 inlines critical CSS and
 *     index.html carries an inline <style> (loader keyframes) plus inline
 *     style="" attributes on the pre-React loader. Drop it only together with
 *     those.
 *
 * NOT included on purpose: reCAPTCHA origins. VITE_RECAPTCHA_SITE_KEY is
 * declared in .env.example but is not wired anywhere in src/ or api/
 * (grep 'recaptcha' → 0 hits). If reCAPTCHA is ever enabled, add
 * "https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/"
 * to script-src and "https://www.google.com https://recaptcha.google.com"
 * to frame-src — otherwise the widget is silently blocked.
 */
const BASE_DIRECTIVES: ReadonlyArray<readonly [string, string]> = [
  ['default-src', "'self'"],
  ['script-src', "'self' https://www.googletagmanager.com"],
  ['style-src', "'self' 'unsafe-inline' https://fonts.googleapis.com"],
  ['img-src', "'self' data: blob: https:"],
  ['font-src', "'self' data: https://fonts.gstatic.com"],
  ['connect-src', CONNECT_SRC_PROD],
  ['worker-src', "'self'"],
  ['manifest-src', "'self'"],
  ['frame-src', "'self'"],
  ['object-src', "'none'"],
  ['frame-ancestors', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
];

/**
 * Build the CSP header value. No trailing semicolon: both forms are valid, and
 * dropping it keeps the string identical when Vercel's response header is
 * echoed back next to ours.
 */
export function buildCsp(opts: { isProduction?: boolean } = {}): string {
  const { isProduction = true } = opts;
  return BASE_DIRECTIVES.map(([directive, value]) => {
    if (!isProduction && directive === 'connect-src') {
      return `${directive} ${value} ${CONNECT_SRC_DEV_EXTRA}`;
    }
    return `${directive} ${value}`;
  }).join('; ');
}

/**
 * The full header set, in a stable order, ready to be applied to a response
 * (http.ts) or serialised into vercel.json (sync script).
 *
 * HSTS is production-only at the API layer: emitting it on
 * http://localhost:3000 would pin the dev host to HTTPS for a year and break
 * the next `npm run dev`. In vercel.json it is unconditional, because that
 * config only ever serves HTTPS deployments (preview + production).
 */
export function getStaticSecurityHeaders(
  opts: { isProduction?: boolean } = {},
): Array<{ key: string; value: string }> {
  const { isProduction = true } = opts;
  const headers: Array<{ key: string; value: string }> = [
    { key: 'Content-Security-Policy', value: buildCsp({ isProduction }) },
    { key: 'X-Frame-Options', value: X_FRAME_OPTIONS_VALUE },
    { key: 'X-Content-Type-Options', value: X_CONTENT_TYPE_OPTIONS_VALUE },
    { key: 'Referrer-Policy', value: REFERRER_POLICY_VALUE },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY_VALUE },
  ];
  if (isProduction) {
    headers.unshift({ key: 'Strict-Transport-Security', value: HSTS_VALUE });
  }
  return headers;
}
