/**
 * Shared HTTP-layer helpers used by both server entries:
 *   • api/_index.ts (Express dev server)
 *   • api/server.ts (Vercel serverless handler)
 *
 * Hoisted so the security headers, CORS origin allow-list, and CSP can't
 * drift between dev and prod. Previously the CSP only existed on the
 * Express path, which meant the Vercel function (i.e. production) shipped
 * no CSP at all — a real security gap that auditors would flag.
 *
 * Each helper takes a minimal pair of `getHeader` / `setHeader`
 * closures so it works for both Express's `res.setHeader` and the
 * VercelResponse's identical surface, without us depending on either
 * package's types from a shared module.
 */

export const ALLOWED_ORIGINS_DEFAULT: ReadonlyArray<string> = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://epimetheusproject.vercel.app',
  'https://epimetheus.ai',
  'https://www.epimetheus.ai',
];

/**
 * Resolve the effective allow-list for this process. The ALLOWED_ORIGINS
 * env var (comma-separated) is additive — anything you set there is
 * appended to the defaults so you can add a staging domain without
 * forgetting prod or localhost.
 */
export function resolveAllowedOrigins(): ReadonlyArray<string> {
  const raw = (process.env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return ALLOWED_ORIGINS_DEFAULT;
  const extras = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return Array.from(new Set([...ALLOWED_ORIGINS_DEFAULT, ...extras]));
}

/**
 * Static security headers. Same set on both servers. The CSP is
 * intentionally tight:
 *   • script-src 'self' only — no unsafe-inline.
 *   • style-src includes 'unsafe-inline' because Tailwind 4 inlines
 *     critical CSS at build time. When we migrate to nonce-based styling
 *     this comes off.
 *   • connect-src restricted to the two upstreams the app actually talks
 *     to: Supabase + Regolo. Sentry's outgoing traffic is initiated by
 *     the SDK to its own DSN host; CSP doesn't affect server-to-server
 *     calls.
 *   • frame-ancestors 'self' blocks clickjacking.
 *
 * HSTS is only emitted in production; on localhost it'd lock the dev
 * domain into HTTPS for a year and break the next dev server start.
 */
export function applySecurityHeaders(opts: {
  setHeader: (name: string, value: string) => void;
  isSecure?: boolean;
  isProduction?: boolean;
}): void {
  const { setHeader, isSecure = false, isProduction = process.env.NODE_ENV === 'production' } = opts;

  setHeader('X-Frame-Options', 'DENY');
  setHeader('X-Content-Type-Options', 'nosniff');
  setHeader('X-XSS-Protection', '1; mode=block');
  setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Google Tag Manager / Analytics is loaded only when VITE_GA_TRACKING_ID
      // is set; allow its host so the script tag isn't blocked.
      "script-src 'self' https://www.googletagmanager.com",
      // Tailwind 4 inlines critical CSS and Google Fonts is loaded as a
      // stylesheet. When you migrate to nonced styles, drop 'unsafe-inline'.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      // Outbound fetch destinations:
      //   • Supabase REST / Realtime / Storage
      //   • Regolo AI (used by /api/ai/chat from server, but client may
      //     occasionally call directly through apiFetch wrappers)
      //   • Sentry browser ingest — wildcard covers regional ingest hosts
      //     (e.g. *.ingest.sentry.io and *.ingest.de.sentry.io). Without
      //     this the browser silently drops Sentry POSTs and we lose all
      //     client-side error capture.
      //   • Google Analytics measurement protocol.
      "connect-src 'self' https://*.supabase.co https://api.regolo.ai https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://www.google-analytics.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Explicit directives for PWA shell — default-src would catch them
      // too but scanners flag missing entries.
      "worker-src 'self'",
      "manifest-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
    ].join('; ') + ';',
  );

  if (isSecure || isProduction) {
    setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }
}

/**
 * Apply CORS headers. Only echoes the requesting origin if it's on the
 * allow-list — never `*`, since we use `Allow-Credentials: true` and
 * browsers reject the combo. Adds `Vary: Origin` so caches don't pin a
 * wrong origin into responses.
 *
 * Returns whether the origin was permitted. Callers can use this for
 * logging or to deny preflights from unrecognised origins explicitly,
 * though the absent ACAO header alone is enough for the browser to
 * block the cross-origin response.
 */
export function applyCorsHeaders(opts: {
  origin: string | undefined;
  setHeader: (name: string, value: string) => void;
  allowedOrigins?: ReadonlyArray<string>;
}): boolean {
  const { origin, setHeader, allowedOrigins = resolveAllowedOrigins() } = opts;

  let permitted = false;
  if (origin && allowedOrigins.includes(origin)) {
    setHeader('Access-Control-Allow-Origin', origin);
    setHeader('Vary', 'Origin');
    permitted = true;
  }
  setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  setHeader('Access-Control-Allow-Credentials', 'true');
  return permitted;
}
