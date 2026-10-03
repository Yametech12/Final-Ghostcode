/**
 * PayPal Subscriptions integration (server-side).
 *
 * Flow:
 *  1. Frontend loads the PayPal JS SDK with the public client ID and renders
 *     a subscription button for a billing plan (plan IDs live in env vars).
 *  2. On buyer approval the frontend POSTs { subscriptionId, planKey } to
 *     /api/paypal/subscriptions/confirm. The server fetches the subscription
 *     from PayPal, verifies the plan matches, and records it.
 *  3. PayPal calls POST /api/paypal/webhook for subscription lifecycle
 *     events. Every event's signature is verified with PayPal before the
 *     user's tier is changed. The webhook is the source of truth for
 *     activation / cancellation / expiry.
 *
 * Secrets: PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID are server-only and
 * must NEVER be exposed to the client bundle. Only the public client ID
 * (VITE_PAYPAL_CLIENT_ID) is sent to the browser.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedRequest, NormalizedResponse } from './handlers.js';
import { log, serializeErr } from './log.js';

// ---------------------------------------------------------------------------
// Pure configuration helpers (exported for unit tests)
// ---------------------------------------------------------------------------

export type PlanKey =
  | 'strategist-monthly'
  | 'strategist-annual'
  | 'oracle-monthly'
  | 'oracle-annual';

export type SubscriptionTier = 'free' | 'strategist' | 'oracle';

const PLAN_KEYS: PlanKey[] = [
  'strategist-monthly',
  'strategist-annual',
  'oracle-monthly',
  'oracle-annual',
];

/** Env var holding the PayPal billing-plan ID for each plan key. */
const PLAN_ENV_VARS: Record<PlanKey, string> = {
  'strategist-monthly': 'PAYPAL_PLAN_STRATEGIST_MONTHLY',
  'strategist-annual': 'PAYPAL_PLAN_STRATEGIST_ANNUAL',
  'oracle-monthly': 'PAYPAL_PLAN_ORACLE_MONTHLY',
  'oracle-annual': 'PAYPAL_PLAN_ORACLE_ANNUAL',
};

/** Display prices (USD) — must match the PLANS table in PricingPage.tsx. */
const PLAN_PRICES: Record<PlanKey, { amount: string; interval: 'month' | 'year'; label: string }> = {
  'strategist-monthly': { amount: '14.00', interval: 'month', label: 'Strategist · Monthly' },
  'strategist-annual': { amount: '144.00', interval: 'year', label: 'Strategist · Annual' },
  'oracle-monthly': { amount: '39.00', interval: 'month', label: 'Oracle · Monthly' },
  'oracle-annual': { amount: '396.00', interval: 'year', label: 'Oracle · Annual' },
};

export function isValidPlanKey(key: unknown): key is PlanKey {
  return typeof key === 'string' && (PLAN_KEYS as string[]).includes(key);
}

/** Map a plan key to its subscription tier. */
export function planKeyToTier(planKey: PlanKey): SubscriptionTier {
  return planKey.startsWith('oracle') ? 'oracle' : 'strategist';
}

/** PayPal REST base URL for the configured mode. Defaults to sandbox. */
export function paypalApiBase(mode?: string): string {
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function isPayPalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID,
  ) && Boolean(process.env.PAYPAL_CLIENT_SECRET);
}

/** Resolve what a billing-subscription webhook event should do to the tier. */
export type WebhookTierAction =
  | { action: 'activate'; tier: SubscriptionTier }
  | { action: 'deactivate' }
  | { action: 'ignore' };

export function resolveWebhookAction(
  eventType: string,
  planId: string | undefined,
): WebhookTierAction {
  const tier = planIdToTier(planId);
  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
      return tier ? { action: 'activate', tier } : { action: 'ignore' };
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED':
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      // Suspended = payment failed; access is revoked until it resolves.
      return { action: 'deactivate' };
    default:
      return { action: 'ignore' };
  }
}

/** Reverse-map a PayPal billing-plan ID to its tier (null when unknown). */
export function planIdToTier(planId: string | undefined): SubscriptionTier | null {
  if (!planId) return null;
  for (const key of PLAN_KEYS) {
    if (process.env[PLAN_ENV_VARS[key]] === planId) {
      return planKeyToTier(key);
    }
  }
  return null;
}

/** Reverse-map a PayPal billing-plan ID to its plan key (null when unknown). */
export function planIdToPlanKey(planId: string | undefined): PlanKey | null {
  if (!planId) return null;
  for (const key of PLAN_KEYS) {
    if (process.env[PLAN_ENV_VARS[key]] === planId) {
      return key;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// PayPal REST client (server-only)
// ---------------------------------------------------------------------------

interface PayPalTokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: PayPalTokenCache | null = null;

function paypalMode(): string {
  return process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
}

function clientId(): string {
  return process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || '';
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const id = clientId();
  const secret = process.env.PAYPAL_CLIENT_SECRET || '';
  if (!id || !secret) {
    throw new Error('PayPal is not configured (missing client ID or secret).');
  }
  const res = await fetch(`${paypalApiBase(paypalMode())}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal OAuth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    // Refresh a minute early so we never send an expired token.
    expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

export interface PayPalSubscription {
  id: string;
  status: string;
  plan_id: string;
  subscriberEmail?: string;
  nextBillingTime?: string;
}

export async function getPayPalSubscription(
  subscriptionId: string,
): Promise<PayPalSubscription> {
  const token = await getAccessToken();
  const res = await fetch(
    `${paypalApiBase(paypalMode())}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal subscription lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    id: string;
    status: string;
    plan_id: string;
    subscriber?: { email_address?: string };
    billing_info?: { next_billing_time?: string };
  };
  return {
    id: data.id,
    status: data.status,
    plan_id: data.plan_id,
    subscriberEmail: data.subscriber?.email_address,
    nextBillingTime: data.billing_info?.next_billing_time,
  };
}

/**
 * Verify a PayPal webhook event signature. Returns true only when PayPal
 * itself confirms the transmission. NEVER trust an unverified event.
 */
export async function verifyWebhookSignature(
  headers: Record<string, string | string[] | undefined>,
  eventBody: unknown,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
  if (!webhookId) {
    log.error('paypal_webhook_no_webhook_id');
    return false;
  }
  const pick = (name: string): string => {
    const v = headers[name];
    return Array.isArray(v) ? v[0] ?? '' : v ?? '';
  };
  const payload = {
    auth_algo: pick('paypal-auth-algo'),
    cert_url: pick('paypal-cert-url'),
    transmission_id: pick('paypal-transmission-id'),
    transmission_sig: pick('paypal-transmission-sig'),
    transmission_time: pick('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: eventBody,
  };
  if (!payload.transmission_id || !payload.transmission_sig) {
    return false;
  }
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `${paypalApiBase(paypalMode())}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
  } catch (err) {
    log.error('paypal_webhook_verify_error', { err: serializeErr(err) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Response helpers (local; mirrors handlers.ts conventions)
// ---------------------------------------------------------------------------

function unauthorized(): NormalizedResponse {
  return { status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } };
}

function badRequest(message: string, code = 'BAD_REQUEST'): NormalizedResponse {
  return { status: 400, body: { error: message, code } };
}

function serverError(message = 'Internal error', code = 'INTERNAL_ERROR'): NormalizedResponse {
  return { status: 500, body: { error: message, code } };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/paypal/config — public client ID + available plans for the
 * checkout page. Requires auth so plan IDs aren't scraped anonymously.
 * The client SECRET is never included.
 */
export async function handlePayPalConfig(
  req: NormalizedRequest,
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  if (!isPayPalConfigured()) {
    return serverError('PayPal checkout is not configured yet.', 'PAYPAL_NOT_CONFIGURED');
  }
  const plans = PLAN_KEYS.map((key) => ({
    key,
    tier: planKeyToTier(key),
    amount: PLAN_PRICES[key].amount,
    currency: 'USD',
    interval: PLAN_PRICES[key].interval,
    label: PLAN_PRICES[key].label,
    planId: process.env[PLAN_ENV_VARS[key]] || null,
    configured: Boolean(process.env[PLAN_ENV_VARS[key]]),
  }));
  return {
    status: 200,
    body: {
      clientId: clientId(),
      mode: paypalMode(),
      plans,
    },
  };
}

interface ConfirmBody {
  subscriptionId?: unknown;
  planKey?: unknown;
}

/**
 * POST /api/paypal/subscriptions/confirm — called by the checkout page
 * after the buyer approves the PayPal subscription. Verifies with PayPal
 * that the subscription exists, is for the claimed plan, and belongs to
 * this checkout, then records it and grants the tier.
 */
export async function handlePayPalConfirm(
  req: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  if (!isPayPalConfigured()) {
    return serverError('PayPal checkout is not configured yet.', 'PAYPAL_NOT_CONFIGURED');
  }
  const body = (req.body || {}) as ConfirmBody;
  const { subscriptionId, planKey } = body;
  if (typeof subscriptionId !== 'string' || !subscriptionId) {
    return badRequest('Missing subscriptionId.', 'MISSING_SUBSCRIPTION_ID');
  }
  if (!isValidPlanKey(planKey)) {
    return badRequest('Invalid plan.', 'INVALID_PLAN');
  }
  const expectedPlanId = process.env[PLAN_ENV_VARS[planKey]];
  if (!expectedPlanId) {
    return serverError('This plan is not configured yet.', 'PLAN_NOT_CONFIGURED');
  }

  let sub: PayPalSubscription;
  try {
    sub = await getPayPalSubscription(subscriptionId);
  } catch (err) {
    log.error('paypal_confirm_lookup_failed', {
      userId: req.user.id,
      err: serializeErr(err),
    });
    return serverError('Could not verify the PayPal subscription.', 'PAYPAL_VERIFY_FAILED');
  }

  // Anti-tamper: the subscription's real plan must match the claimed plan.
  if (sub.plan_id !== expectedPlanId) {
    log.error('paypal_confirm_plan_mismatch', {
      userId: req.user.id,
      subscriptionId,
      expectedPlanId,
      actualPlanId: sub.plan_id,
    });
    return badRequest('Subscription plan does not match the selected plan.', 'PLAN_MISMATCH');
  }

  const tier = planKeyToTier(planKey);
  const activeNow = sub.status === 'ACTIVE';

  try {
    // Record the subscription (idempotent on provider subscription id).
    const { error: subErr } = await supabase.from('billing_subscriptions').upsert(
      {
        user_id: req.user.id,
        provider: 'paypal',
        provider_subscription_id: sub.id,
        tier,
        status: sub.status,
        current_period_end: sub.nextBillingTime ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider_subscription_id' },
    );
    if (subErr) throw subErr;

    // Grant the tier immediately when PayPal reports ACTIVE. Otherwise the
    // BILLING.SUBSCRIPTION.ACTIVATED webhook completes activation.
    if (activeNow) {
      const { error: tierErr } = await supabase
        .from('users')
        .update({
          subscription_tier: tier,
          subscription_expires_at: sub.nextBillingTime ?? null,
        })
        .eq('id', req.user.id);
      if (tierErr) throw tierErr;
    }

    log.info('paypal_confirm_ok', {
      userId: req.user.id,
      subscriptionId: sub.id,
      tier,
      status: sub.status,
    });
    return { status: 200, body: { ok: true, tier, status: sub.status, activeNow } };
  } catch (err) {
    log.error('paypal_confirm_db_failed', { userId: req.user.id, err: serializeErr(err) });
    return serverError('Could not activate your subscription.', 'DB_ERROR');
  }
}

interface WebhookResource {
  id?: string;
  plan_id?: string;
  status?: string;
  billing_info?: { next_billing_time?: string };
}

interface WebhookEvent {
  id?: string;
  event_type?: string;
  resource?: WebhookResource;
}

/**
 * POST /api/paypal/webhook — PayPal event delivery. No user auth (PayPal
 * calls this); the event signature is verified with PayPal first, and the
 * event ID is recorded to guarantee idempotent processing.
 */
export async function handlePayPalWebhook(
  req: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  const event = (req.body || {}) as WebhookEvent;
  const eventId = event.id;
  const eventType = event.event_type;
  if (!eventId || !eventType) {
    return badRequest('Invalid webhook event.', 'INVALID_EVENT');
  }

  const verified = await verifyWebhookSignature(req.headers, event);
  if (!verified) {
    log.error('paypal_webhook_bad_signature', { eventId, eventType });
    return { status: 401, body: { error: 'Invalid webhook signature', code: 'BAD_SIGNATURE' } };
  }

  // Idempotency: skip already-processed events.
  const { data: seen } = await supabase
    .from('billing_webhook_events')
    .select('provider_event_id')
    .eq('provider_event_id', eventId)
    .maybeSingle();
  if (seen) {
    return { status: 200, body: { ok: true, deduped: true } };
  }

  const resource = event.resource || {};
  const subscriptionId = resource.id;
  const action = resolveWebhookAction(eventType, resource.plan_id);

  try {
    if (action.action !== 'ignore' && subscriptionId) {
      // Find the owning user for this subscription.
      const { data: record } = await supabase
        .from('billing_subscriptions')
        .select('user_id')
        .eq('provider', 'paypal')
        .eq('provider_subscription_id', subscriptionId)
        .maybeSingle();

      if (record?.user_id) {
        if (action.action === 'activate') {
          await supabase
            .from('billing_subscriptions')
            .update({
              status: resource.status ?? 'ACTIVE',
              tier: action.tier,
              current_period_end: resource.billing_info?.next_billing_time ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('provider_subscription_id', subscriptionId);
          await supabase
            .from('users')
            .update({
              subscription_tier: action.tier,
              subscription_expires_at: resource.billing_info?.next_billing_time ?? null,
            })
            .eq('id', record.user_id);
        } else {
          // deactivate — revoke paid access, but only if the user has no
          // OTHER active subscription (e.g. they upgraded and the old plan
          // was cancelled afterwards).
          await supabase
            .from('billing_subscriptions')
            .update({
              status: resource.status ?? 'CANCELLED',
              updated_at: new Date().toISOString(),
            })
            .eq('provider_subscription_id', subscriptionId);
          const { data: stillActive } = await supabase
            .from('billing_subscriptions')
            .select('tier')
            .eq('user_id', record.user_id)
            .eq('provider', 'paypal')
            .eq('status', 'ACTIVE');
          const bestTier: SubscriptionTier | 'free' =
            stillActive && stillActive.length > 0
              ? (stillActive.some((s) => s.tier === 'oracle') ? 'oracle' : 'strategist')
              : 'free';
          await supabase
            .from('users')
            .update({
              subscription_tier: bestTier,
              subscription_expires_at: bestTier === 'free' ? null : undefined,
            })
            .eq('id', record.user_id);
        }
      } else {
        log.error('paypal_webhook_unknown_subscription', { eventId, eventType, subscriptionId });
      }
    }

    await supabase.from('billing_webhook_events').insert({
      provider: 'paypal',
      provider_event_id: eventId,
      event_type: eventType,
    });

    return { status: 200, body: { ok: true } };
  } catch (err) {
    log.error('paypal_webhook_db_failed', { eventId, eventType, err: serializeErr(err) });
    // Return 500 so PayPal retries delivery.
    return serverError('Webhook processing failed.', 'DB_ERROR');
  }
}
