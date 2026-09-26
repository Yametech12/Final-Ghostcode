/**
 * Typed client wrapper for the billing endpoints.
 *
 * All calls go through apiFetch (JWT + X-Requested-With are attached
 * automatically — the server's CSRF check requires the custom header).
 * Every function returns the Stripe-hosted URL to redirect to, or throws
 * a BillingError with a user-presentable message.
 */

import { apiFetch } from './fetch';

export type PaidTier = 'strategist' | 'oracle';

export class BillingError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 0) {
    super(message);
    this.name = 'BillingError';
    this.code = code;
    this.status = status;
  }
}

interface BillingUrlResponse {
  url?: string;
  error?: string;
  code?: string;
}

async function postBillingJson(path: string, body: unknown): Promise<string> {
  let res: Response;
  try {
    res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BillingError('Network error — check your connection and try again.', 'NETWORK_ERROR');
  }

  let data: BillingUrlResponse | null = null;
  try {
    data = (await res.json()) as BillingUrlResponse;
  } catch {
    data = null;
  }

  if (!res.ok || !data?.url) {
    throw new BillingError(
      data?.error ?? `Request failed with status ${res.status}`,
      data?.code ?? 'REQUEST_FAILED',
      res.status,
    );
  }
  return data.url;
}

/** Start Stripe Checkout for a paid tier. Resolves to the checkout URL. */
export function createCheckoutSession(tier: PaidTier): Promise<string> {
  return postBillingJson('/api/billing/create-checkout-session', { tier });
}

/**
 * Open the Stripe Customer Portal for self-serve plan changes.
 * `customerId` is optional — the server resolves the caller's own stored
 * customer when omitted, and rejects IDs that don't belong to the caller.
 */
export function createPortalSession(customerId?: string): Promise<string> {
  return postBillingJson(
    '/api/billing/create-portal-session',
    customerId ? { customer_id: customerId } : {},
  );
}
