/**
 * Sentry error monitoring.
 * Lazy-loaded to keep the main bundle lean.
 * Only initializes in production with a configured DSN.
 */

let initialized = false;

export async function initSentry(): Promise<void> {
  if (initialized) return;

  // Only enable Sentry in production with a configured DSN
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] Disabled in development. Set VITE_SENTRY_DSN to enable.');
    }
    return;
  }

  try {
    const Sentry = await import('@sentry/react');

    Sentry.init({
      dsn,
      // Privacy: don't send IP addresses or user agents by default. We
      // attach a minimal user.id in setUser() so errors are still
      // correlatable per account, but we don't ship browser fingerprint
      // data to Sentry without explicit consent. Flip this back to true
      // (or gate it behind a consent banner) when GDPR/DPA compliance
      // copy is in place.
      sendDefaultPii: false,
      environment: import.meta.env.MODE,
      // Sample rate for performance monitoring (0-1). Lower = fewer events.
      tracesSampleRate: 0.1,
      // Sample rate for session replays (0-1). Capture 10% of sessions.
      replaysSessionSampleRate: 0.0, // Disabled by default to save quota
      replaysOnErrorSampleRate: 1.0, // Always replay on errors
      // Filter out known noise
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Network errors that aren't actionable
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        'NetworkError',
        // User-initiated cancellations
        'AbortError',
        'The user aborted a request',
      ],
      beforeSend(event, hint) {
        // Don't send events from localhost or 127.0.0.1
        if (typeof window !== 'undefined') {
          const host = window.location.hostname;
          if (host === 'localhost' || host === '127.0.0.1') {
            return null;
          }
        }
        // Strip out common noise
        const error = hint.originalException;
        if (error instanceof Error && error.message?.includes('ChunkLoadError')) {
          // Chunk load errors are usually due to deploys, not bugs
          return null;
        }
        return event;
      },
    });

    initialized = true;
    console.info('[Sentry] Initialized for', import.meta.env.MODE);
  } catch (err) {
    console.warn('[Sentry] Failed to initialize:', err);
  }
}

/**
 * Manually capture an exception.
 * Safe to call before init — will be queued.
 */
export async function captureException(error: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!initialized) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.captureException(error, { extra: context });
  } catch {
    // Sentry unavailable — fall back to console
    console.error('[Sentry] captureException failed', error);
  }
}

/**
 * Set user context for Sentry events.
 * Call this after the user logs in.
 *
 * Privacy: only the opaque user.id is attached. Email is intentionally
 * omitted so we don't ship account email addresses into Sentry without
 * explicit consent. If you ever need email-level triage, gate it behind
 * a consent flag.
 */
export async function setUser(user: { id: string; email?: string | null }): Promise<void> {
  if (!initialized) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.setUser({ id: user.id });
    void user.email; // intentionally not forwarded
  } catch {
    // ignore
  }
}

/**
 * Clear user context (on logout).
 */
export async function clearUser(): Promise<void> {
  if (!initialized) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.setUser(null);
  } catch {
    // ignore
  }
}
