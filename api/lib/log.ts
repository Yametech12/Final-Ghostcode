/**
 * Tiny structured logger for the API layer.
 *
 * Vercel's function logs preserve stdout line-by-line. By emitting a single
 * JSON object per log line we get queryable logs in the Vercel dashboard
 * (and downstream sinks like Datadog / Logtail) without pulling in a heavy
 * dependency. Compared to raw `console.log`, every line carries:
 *   • `ts`   — ISO timestamp
 *   • `level`— info | warn | error
 *   • `msg`  — short human-readable summary
 *   • `...ctx` — caller-supplied fields (userId, requestId, route, etc.)
 *
 * Keep this module dependency-free: it runs on the cold-start path of
 * every API invocation and adding `pino` etc. would inflate function size.
 *
 * PII reminder: do NOT pass raw email addresses or full JWTs through here.
 * Use `redactEmail()` for emails and never log the bearer token.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  /** Stable request correlation id; build with `requestIdFrom(req.headers)`. */
  requestId?: string;
  /** Authenticated user id when known. Never the email. */
  userId?: string;
  /** Route path that produced the log, e.g. `POST /api/advisor/chat`. */
  route?: string;
  /**
   * Opt out of Sentry auto-forwarding for this single log line. Used by
   * call sites that ALSO call captureException() explicitly so we don't
   * generate two distinct Sentry events for the same error.
   */
  _skipSentry?: boolean;
  /** Free-form structured fields. Anything serializable is fine. */
  [key: string]: unknown;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Minimum level to actually emit. Defaults to `info` in production and
 * `debug` elsewhere; override with LOG_LEVEL env var if needed.
 */
function configuredMinLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || '').toLowerCase();
  if (env === 'debug' || env === 'info' || env === 'warn' || env === 'error') {
    return env as LogLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const MIN_RANK = LEVEL_RANK[configuredMinLevel()];

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (LEVEL_RANK[level] < MIN_RANK) return;

  // Build the record manually so the order is predictable in log search:
  // ts → level → msg → context fields.
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
  };
  if (ctx) {
    for (const [k, v] of Object.entries(ctx)) {
      if (v === undefined) continue;
      record[k] = v;
    }
  }

  // JSON.stringify is fast on the hot path, and circular references are
  // rare. Try the cheap path first; only allocate the WeakSet replacer if
  // the cheap path actually throws. This trims a per-line allocation off
  // the steady-state logger (info/debug log lines on every request) for
  // a microbenchmark win that adds up under load.
  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    try {
      const seen = new WeakSet();
      line = JSON.stringify(record, (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      });
    } catch {
      line = JSON.stringify({
        ts: record.ts,
        level,
        msg,
        _logFallback: 'stringify_failed',
      });
    }
  }

  // Route warn/error to stderr so Vercel's log sink colors them and ops
  // dashboards can filter on stream. info/debug stay on stdout.
  if (level === 'warn' || level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }

  // Forward errors to Sentry (no-op until initSentryNode runs and SENTRY_DSN
  // is set). Wrapped in try/catch and gated to errors only so steady-state
  // info/warn logs don't burn Sentry quota or risk a crash if the import
  // itself fails. The forwarder is loaded lazily to avoid pulling Sentry
  // into the cold-start path of functions that never error.
  //
  // `_skipSentry: true` opts out — used by call sites that ALSO call
  // captureException() explicitly, so we don't double-count one error
  // as two distinct Sentry events (the explicit capture has the real
  // stack, the log-forward only has a synthetic one — Sentry doesn't
  // dedupe between them).
  if (level === 'error' && !ctx?._skipSentry) {
    forwardToSentry(msg, ctx);
  }
}

/**
 * Lazy Sentry forwarder. Imports the wrapper on first error so the import
 * never blocks the happy path. If the import fails (e.g. during a cold
 * start before deps resolve), errors still land in stdout/stderr — we
 * just lose the Sentry copy. We retry the import after a 30s cooldown
 * so a single transient failure doesn't disable forwarding for the
 * lifetime of the process.
 */
let sentryForwarder: ((msg: string, ctx: LogContext | undefined) => void) | null = null;
let sentryImportTriedAt = 0;
const SENTRY_IMPORT_COOLDOWN_MS = 30_000;

function forwardToSentry(msg: string, ctx: LogContext | undefined): void {
  if (sentryForwarder) {
    try { sentryForwarder(msg, ctx); } catch { /* ignore */ }
    return;
  }
  // Backoff between import attempts so a flapping import doesn't burn
  // event-loop cycles.
  if (Date.now() - sentryImportTriedAt < SENTRY_IMPORT_COOLDOWN_MS) return;
  sentryImportTriedAt = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import('./sentryNode.js')
    .then((mod) => {
      sentryForwarder = (m, c) => mod.captureFromLog(m, c);
      try { sentryForwarder(msg, ctx); } catch { /* ignore */ }
    })
    .catch(() => {
      // Sentry forwarder unavailable — keep logging to stdout only.
    });
}

export const log = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};

/**
 * Best-effort serializer for `unknown` errors caught from third-party
 * code. Captures name, message, stack, and any extra enumerable
 * properties. Safe to drop directly into a log context as `err: ...`.
 */
export function serializeErr(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    if (err.stack) out.stack = err.stack;
    for (const k of Object.getOwnPropertyNames(err)) {
      if (k === 'name' || k === 'message' || k === 'stack') continue;
      out[k] = (err as unknown as Record<string, unknown>)[k];
    }
    return out;
  }
  if (typeof err === 'object' && err !== null) {
    return { ...(err as Record<string, unknown>) };
  }
  return { value: String(err) };
}

/**
 * Redact an email to `f***@domain` so logs can correlate complaints
 * without storing full PII. Mirrors the pattern in handleSecurityLog.
 */
export function redactEmail(raw: string | undefined | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  return raw.replace(/^([^@]).*@/, '$1***@').slice(0, 100);
}

/**
 * Derive a stable request id from incoming headers. Honors
 * `x-request-id` (Vercel sets one for every invocation). Falls back to a
 * timestamp + random tail so logs from the same request can still be
 * grouped.
 */
export function requestIdFrom(headers: Record<string, string | string[] | undefined>): string {
  const xreq = headers['x-request-id'] || headers['x-vercel-id'];
  if (typeof xreq === 'string' && xreq.length > 0) return xreq.slice(0, 80);
  if (Array.isArray(xreq) && xreq.length > 0) return String(xreq[0]).slice(0, 80);
  // Cheap fallback: ms-precision timestamp + 4 hex chars.
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(16)}`;
}
