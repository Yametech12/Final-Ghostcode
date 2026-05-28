/**
 * Server-side Sentry wrapper.
 *
 * Mirrors the privacy posture of the React-side `lib/sentry.ts`:
 *   • No PII by default (`sendDefaultPii: false`).
 *   • Only the opaque `user.id` is attached, never `user.email`.
 *
 * Lazy-loaded so cold starts that never raise an error don't pay the
 * Sentry boot cost. Init happens once per Node process; subsequent
 * invocations of warm Vercel functions reuse the same instance.
 *
 * Wire-up:
 *   1. `initSentryNode()` is called from each server entry near the top
 *      (api/_index.ts boot, api/server.ts module load).
 *   2. The structured logger forwards `log.error()` calls to Sentry via
 *      `captureFromLog()` so we get unhandled exception coverage without
 *      sprinkling captureException() at every call site.
 *   3. Both server entries also call `captureException()` directly in
 *      their last-resort try/catch blocks, ensuring the request gets
 *      captured even if the structured logger isn't on the path.
 *
 * Configuration:
 *   • Reads SENTRY_DSN (server-only, never `VITE_`-prefixed).
 *   • If unset, every function below becomes a no-op so dev / unconfigured
 *     deploys don't fail at import time.
 *   • `tracesSampleRate` deliberately low (0.05) — performance traces are
 *     expensive on Vercel function-invocation pricing.
 */

let initialized = false;
let SentryRef: typeof import('@sentry/node') | null = null;

export async function initSentryNode(): Promise<void> {
  if (initialized) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info('[sentry/node] Disabled — set SENTRY_DSN to enable.');
    }
    return;
  }

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      // Privacy: same posture as the client. No IP / user-agent / cookies
      // until consent UX is in place.
      sendDefaultPii: false,
      // Sample rate for transactions; keep low to avoid burning quota
      // on traffic we're not actively investigating.
      tracesSampleRate: 0.05,
      // Drop known noise. AbortError from cancelled SSE streams isn't
      // actionable — it's a user closing their tab mid-reply.
      ignoreErrors: ['AbortError', 'TimeoutError'],
      beforeSend(event, hint) {
        const err = hint.originalException as Error | undefined;
        if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
          return null;
        }
        return event;
      },
    });
    SentryRef = Sentry;
    initialized = true;
    // eslint-disable-next-line no-console
    console.info('[sentry/node] Initialized for', process.env.NODE_ENV || 'production');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sentry/node] init failed:', err);
  }
}

/**
 * Capture an exception with optional structured context. Safe to call
 * before init resolves — no-ops if Sentry isn't configured. The `tags`
 * map is searchable in the Sentry UI; `extra` is shown on the event
 * detail page.
 */
export function captureException(
  error: unknown,
  context?: { userId?: string; route?: string; requestId?: string; extra?: Record<string, unknown> },
): void {
  if (!initialized || !SentryRef) return;
  try {
    SentryRef.withScope((scope) => {
      if (context?.userId) scope.setUser({ id: context.userId });
      if (context?.requestId) scope.setTag('requestId', context.requestId);
      if (context?.route) scope.setTag('route', context.route);
      if (context?.extra) scope.setContext('extra', context.extra);
      SentryRef!.captureException(error);
    });
  } catch {
    // Swallow — Sentry must never bring down a request handler.
  }
}

/**
 * Forward a structured-log error event to Sentry. The logger calls this
 * automatically for `log.error(...)` so we don't have to add manual
 * captureException() at every site.
 */
export function captureFromLog(msg: string, ctx: Record<string, unknown> | undefined): void {
  if (!initialized || !SentryRef) return;
  try {
    const err = ctx?.err && typeof ctx.err === 'object' ? (ctx.err as Record<string, unknown>) : null;
    // Build a synthetic Error so Sentry has a name + stack to group on.
    // If the original error stack is in the context, prefer that for
    // grouping; otherwise the synthetic one will at least dedupe by msg.
    const synthetic: Error & { name: string } = Object.assign(
      new Error(typeof err?.message === 'string' ? err.message : msg),
      { name: typeof err?.name === 'string' ? err.name : msg },
    );
    if (typeof err?.stack === 'string') synthetic.stack = err.stack;

    SentryRef.withScope((scope) => {
      if (typeof ctx?.userId === 'string') scope.setUser({ id: ctx.userId });
      if (typeof ctx?.requestId === 'string') scope.setTag('requestId', ctx.requestId);
      if (typeof ctx?.route === 'string') scope.setTag('route', ctx.route);
      // The full structured context (minus the error itself) is helpful
      // for triage but not for grouping.
      const safeCtx = ctx ? { ...ctx } : {};
      delete (safeCtx as Record<string, unknown>).err;
      scope.setContext('logContext', safeCtx);
      scope.setTag('logMsg', msg);
      SentryRef!.captureException(synthetic);
    });
  } catch {
    // ignore
  }
}

/**
 * (Removed) Setting the user on the global Sentry scope is unsafe in
 * Vercel functions because warm processes serve concurrent invocations.
 * Use `captureException`/`captureFromLog` with a `userId` in context —
 * those use `withScope` per-call which is concurrency-safe. The old
 * global setUser remains intentionally absent.
 */

/**
 * Force any pending events to flush before the function returns. Vercel
 * serverless freezes the runtime as soon as the response ends, so without
 * this the last error of an invocation can be dropped. Call near the end
 * of cold-path error handlers.
 */
export async function flush(timeoutMs = 2000): Promise<void> {
  if (!initialized || !SentryRef) return;
  try {
    await SentryRef.flush(timeoutMs);
  } catch {
    // ignore
  }
}
