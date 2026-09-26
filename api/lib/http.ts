/**
 * Shared HTTP-layer helpers used by both server entries:
 *   • api/_index.ts (Express dev server)
 *   • api/server.ts (Vercel serverless handler)
 *
 * Hoisted so the security headers, CORS origin allow-list, and CSP can't
 * drift between dev and prod.
 *
 * The header VALUES no longer live here — they live in ./securityHeaders.ts,
 * which is also what `scripts/sync-vercel-headers.ts` reads to generate the
 * `headers` block in vercel.json. Rationale: the app HTML (/, /index.html,
 * /assets/*) is served by the CDN, never by this function, so the same policy
 * has to exist in two places. Two hand-maintained copies = guaranteed drift;
 * one module + a CI check = one policy.
 *
 * Each helper takes a minimal pair of `getHeader` / `setHeader` closures so it
 * works for both Express's `res.setHeader` and the VercelResponse's identical
 * surface, without us depending on either package's types from a shared module.
 */

import {
  buildCsp,
  getStaticSecurityHeaders,
} from './securityHeaders.js';

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
 * Static security headers — see ./securityHeaders.ts for the policy and the
 * reasoning behind each directive. This function only decides *whether* the
 * production variant applies.
 *
 * isProduction (NODE_ENV=production) OR isSecure (the request arrived over TLS)
 * both select the production header set: on a TLS-terminating proxy the dev
 * server is effectively serving real traffic and should pin HSTS + the tight
 * connect-src. On plain http://localhost nothing is pinned and the dev-only
 * connect-src entries (ws://… HMR sockets) are added.
 */
export function applySecurityHeaders(opts: {
  setHeader: (name: string, value: string) => void;
  isSecure?: boolean;
  isProduction?: boolean;
}): void {
  const {
    setHeader,
    isSecure = false,
    isProduction = process.env.NODE_ENV === 'production',
  } = opts;

  const productionHeaders = isProduction || isSecure;

  for (const { key, value } of getStaticSecurityHeaders({
    isProduction: productionHeaders,
  })) {
    setHeader(key, value);
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

// Re-exported so callers that want the raw policy string (tests, diagnostics)
// don't have to know which module it now lives in.
export { buildCsp };
