/**
 * Centralized handling of structured API errors.
 *
 * Every server handler returns a JSON body shaped like:
 *   { error: string, code?: string, requiredTier?, currentTier?, retryAfter?, requestId? }
 *
 * Pages calling those endpoints used to do `errJson.error` and pipe the
 * raw English string into a toast. That hides the structured info we
 * already carry — particularly the tier-gate (`PAYMENT_REQUIRED`) which
 * should drop the user on PaywallScreen, and `AI_TIMEOUT` /
 * `MODEL_UNAVAILABLE` which deserve user-meaningful retry messaging.
 *
 * Use `parseApiError(response)` after a non-OK fetch to get the
 * normalized shape, then `apiErrorToast(parsed)` if you want the default
 * toast UX, or branch on `parsed.code` yourself for a custom flow
 * (e.g. redirect to /pricing).
 */

import { toast } from 'sonner';

export interface ParsedApiError {
  status: number;
  /** Server-provided machine code, when present. */
  code?: string;
  /** User-facing error string from the server, may be generic. */
  message: string;
  /** Tier the user needs to access this feature. */
  requiredTier?: 'strategist' | 'oracle';
  /** Tier the server thinks the user has right now. */
  currentTier?: 'free' | 'strategist' | 'oracle';
  /** Seconds (or string from upstream) the client should wait before retrying. */
  retryAfter?: number | string | null;
  /** Server-side request id for support correlation. */
  requestId?: string;
}

const DEFAULT_GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Read the server's structured error from a non-OK Response. Falls back
 * to a generic message when the body isn't JSON.
 */
export async function parseApiError(response: Response): Promise<ParsedApiError> {
  const status = response.status;
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    /* response wasn't JSON */
  }
  const message =
    (typeof body?.error === 'string' && body.error) ||
    response.statusText ||
    DEFAULT_GENERIC_MESSAGE;
  return {
    status,
    code: typeof body?.code === 'string' ? body.code : undefined,
    message,
    requiredTier: body?.requiredTier,
    currentTier: body?.currentTier,
    retryAfter: body?.retryAfter ?? null,
    requestId: typeof body?.requestId === 'string' ? body.requestId : undefined,
  };
}

/**
 * Friendly toast for the most common error codes. Returns `true` when a
 * specialized message was shown so the caller can decide whether to
 * fall through to its own handling.
 *
 * Pages that want page-aware behaviour (e.g. AdvisorPage redirecting on
 * PAYMENT_REQUIRED) should branch on `code` themselves before calling
 * this helper.
 */
export function apiErrorToast(err: ParsedApiError): void {
  switch (err.code) {
    case 'PAYMENT_REQUIRED': {
      const tier = err.requiredTier ?? 'paid';
      toast.error(`This feature requires the ${tier} plan.`, {
        description: 'Upgrade to continue.',
        action: {
          label: 'View plans',
          onClick: () => {
            window.location.href = '/pricing';
          },
        },
      });
      return;
    }
    case 'AI_TIMEOUT':
      toast.error('The AI took too long to respond.', {
        description: 'Try again in a moment — large prompts can be slow.',
      });
      return;
    case 'MODEL_UNAVAILABLE':
      toast.error('The AI is temporarily unavailable.', {
        description: 'Falling back automatically. Retry shortly.',
      });
      return;
    case 'RATE_LIMITED':
    case 'USER_RATE_LIMITED': {
      const seconds = typeof err.retryAfter === 'number' ? err.retryAfter : null;
      toast.error('You\'re going too fast.', {
        description: seconds
          ? `Try again in ${seconds} seconds.`
          : 'Please wait a moment before retrying.',
      });
      return;
    }
    case 'SUBSCRIPTION_LOOKUP_FAILED':
      toast.error('Subscription check is temporarily unavailable.', {
        description: 'Try again in a moment.',
      });
      return;
    case 'AI_AUTH_FAILED':
    case 'AI_NO_CREDITS':
      toast.error('AI service is temporarily unavailable.', {
        description: 'The team has been notified.',
      });
      return;
    case 'CSRF_CHECK_FAILED':
      toast.error('Session check failed. Please refresh and try again.');
      return;
    case 'UNAUTHORIZED':
      toast.error('Please sign in to continue.');
      return;
    default: {
      const ref = err.requestId ? ` Ref: ${err.requestId.slice(-8)}` : '';
      toast.error(err.message, {
        description: err.status >= 500 ? `We're looking into it.${ref}` : undefined,
      });
    }
  }
}

/**
 * Shorthand: parse + toast in one call. Returns the parsed error so the
 * caller can still branch on `code` for specialized flows after the
 * default toast has fired.
 */
export async function handleApiError(response: Response): Promise<ParsedApiError> {
  const parsed = await parseApiError(response);
  apiErrorToast(parsed);
  return parsed;
}
