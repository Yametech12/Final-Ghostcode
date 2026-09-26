/**
 * Billing handlers shared by both server entries:
 *   • api/_index.ts   (Express dev server)
 *   • api/server.ts   (Vercel serverless handler)
 *
 * Endpoints:
 *   POST /api/billing/webhook                — Stripe-signed, NO JWT, raw body
 *   POST /api/billing/create-checkout-session — JWT required
 *   POST /api/billing/create-portal-session   — JWT required
 *
 * Tier model (unchanged — tierGate.ts stays the single source of truth):
 *   free < strategist < oracle. Every write here calls
 *   invalidateTierCache(userId) so the 30s tier cache in tierGate.ts picks
 *   the change up immediately.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

import { getStripe, verifyStripeSignature, tierFromPriceId } from './stripe.js';
import { invalidateTierCache } from './tierGate.js';
import { log, serializeErr } from './log.js';
import type { NormalizedRequest, NormalizedResponse } from './handlers.js';

/** How long a user keeps paid access after invoice.payment_failed. */
const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;
/** Checkout expiry used for subscription_expires_at until the first
 *  customer.subscription.updated reconciles it to the real period end. */
const INITIAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function unauthorized(): NormalizedResponse {
  return { status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } };
}

function serverError(message: string, code: string): NormalizedResponse {
  return { status: 500, body: { error: message, code } };
}

function notConfigured(): NormalizedResponse {
  return {
    status: 503,
    body: { error: 'Billing is not configured', code: 'BILLING_NOT_CONFIGURED' },
  };
}

function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function paidTierFromMetadata(value: unknown): 'strategist' | 'oracle' | null {
  return value === 'strategist' || value === 'oracle' ? value : null;
}

function customerIdOf(value: Stripe.Checkout.Session['customer']): string | null {
  if (typeof value === 'string') return value;
  return value?.id ?? null;
}

// ---------------------------------------------------------------------------
// POST /api/billing/create-checkout-session   (JWT required)
// Body: { tier: 'strategist' | 'oracle' } → { url }
// ---------------------------------------------------------------------------
export async function handleCreateCheckoutSession(
  nr: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  const stripe = getStripe();
  if (!stripe) return notConfigured();
  if (!nr.user) return unauthorized();

  const tier = paidTierFromMetadata(nr.body?.tier);
  if (!tier) {
    return { status: 400, body: { error: 'tier must be "strategist" or "oracle"', code: 'INVALID_TIER' } };
  }

  const priceId = tier === 'strategist'
    ? process.env.STRIPE_PRICE_STRATEGIST
    : process.env.STRIPE_PRICE_ORACLE;
  if (!priceId) {
    return {
      status: 503,
      body: { error: 'Price for the selected plan is not configured', code: 'PRICE_NOT_CONFIGURED' },
    };
  }

  const { data: row, error: lookupErr } = await supabase
    .from('users')
    .select('id, email, stripe_customer_id')
    .eq('id', nr.user.id)
    .maybeSingle();
  if (lookupErr) return serverError('Failed to load account', 'USER_LOOKUP_FAILED');

  // Reuse the stored customer when valid; otherwise create one and persist
  // it so the webhook can match future subscription events to this user.
  let customerId =
    typeof row?.stripe_customer_id === 'string' && row.stripe_customer_id.startsWith('cus_')
      ? row.stripe_customer_id
      : null;
  if (!customerId) {
    const email = typeof row?.email === 'string' && row.email ? row.email : nr.user.email ?? undefined;
    const customer = await stripe.customers.create({
      email: email || undefined,
      metadata: { userId: nr.user.id },
    });
    customerId = customer.id;
    const { error: saveErr } = await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', nr.user.id);
    if (saveErr) {
      log.error('stripe_customer_save_failed', { userId: nr.user.id, err: serializeErr(saveErr) });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Lets checkout.session.completed attribute the purchase even if the
    // client closed the tab before the redirect completed.
    client_reference_id: nr.user.id,
    metadata: { userId: nr.user.id, tier },
    subscription_data: { metadata: { userId: nr.user.id, tier } },
    success_url: `${appUrl()}/profile?billing=success`,
    cancel_url: `${appUrl()}/pricing?billing=cancelled`,
  });

  if (!session.url) {
    return serverError('Checkout session did not include a URL', 'CHECKOUT_URL_MISSING');
  }
  return { status: 200, body: { url: session.url } };
}

// ---------------------------------------------------------------------------
// POST /api/billing/create-portal-session   (JWT required)
// Body: { customer_id? } → { url }
// ---------------------------------------------------------------------------
export async function handleCreatePortalSession(
  nr: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  const stripe = getStripe();
  if (!stripe) return notConfigured();
  if (!nr.user) return unauthorized();

  const requested = typeof nr.body?.customer_id === 'string' ? nr.body.customer_id : null;

  const { data: row, error: lookupErr } = await supabase
    .from('users')
    .select('id, stripe_customer_id')
    .eq('id', nr.user.id)
    .maybeSingle();
  if (lookupErr) return serverError('Failed to load account', 'USER_LOOKUP_FAILED');

  const stored = typeof row?.stripe_customer_id === 'string' ? row.stripe_customer_id : null;

  // IDOR guard: a caller may only open the portal for the customer linked to
  // their own account. Passing someone else's customer_id is rejected here,
  // before Stripe ever sees it.
  if (requested && stored && requested !== stored) {
    return {
      status: 403,
      body: { error: 'Customer ID does not belong to this account', code: 'CUSTOMER_MISMATCH' },
    };
  }

  const customerId = requested ?? stored;
  if (!customerId || !customerId.startsWith('cus_')) {
    return {
      status: 400,
      body: {
        error: 'No Stripe customer on file yet — upgrade to a paid plan first',
        code: 'NO_CUSTOMER',
      },
    };
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl()}/profile`,
  });
  return { status: 200, body: { url: portal.url } };
}

// ---------------------------------------------------------------------------
// POST /api/billing/webhook   (Stripe-Signature auth — no JWT, raw body)
// ---------------------------------------------------------------------------

/** Resolve which user row a Stripe object belongs to: metadata first, then
 *  stripe_subscription_id, then stripe_customer_id. */
async function resolveUserId(
  supabase: SupabaseClient,
  ids: { metadataUserId?: unknown; subscriptionId?: string | null; customerId?: string | null },
): Promise<string | null> {
  if (typeof ids.metadataUserId === 'string' && ids.metadataUserId) return ids.metadataUserId;

  if (ids.subscriptionId) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_subscription_id', ids.subscriptionId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (ids.customerId) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', ids.customerId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

async function onCheckoutCompleted(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<NormalizedResponse> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Only grant access once payment actually succeeded.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { status: 200, body: { received: true, ignored: `payment_status=${session.payment_status}` } };
  }

  const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
  const tier = paidTierFromMetadata(session.metadata?.tier);
  if (!userId || !tier) {
    log.warn('stripe_checkout_missing_identity', { eventId: event.id });
    return { status: 200, body: { received: true, ignored: 'missing user or tier' } };
  }

  const expiresIso = new Date(Date.now() + INITIAL_PERIOD_MS).toISOString();
  const { error } = await supabase
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_expires_at: expiresIso,
      stripe_customer_id: customerIdOf(session.customer),
      stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
      billing_grace_period_until: null,
    })
    .eq('id', userId);

  if (error) {
    log.error('stripe_checkout_update_failed', { eventId: event.id, userId, err: serializeErr(error) });
    throw new Error('users update failed for checkout.session.completed');
  }
  invalidateTierCache(userId);
  return { status: 200, body: { received: true } };
}

async function onSubscriptionUpdated(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<NormalizedResponse> {
  const sub = event.data.object as Stripe.Subscription;
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const tier = tierFromPriceId(priceId);

  const userId = await resolveUserId(supabase, {
    metadataUserId: sub.metadata?.userId,
    subscriptionId: sub.id,
    customerId: customerIdOf(sub.customer),
  });
  if (!userId) {
    log.warn('stripe_subscription_unmatched', { eventId: event.id, subscriptionId: sub.id });
    return { status: 200, body: { received: true, ignored: 'no matching user' } };
  }
  if (!tier) {
    // Unknown price — reconcile the expiry but never guess the tier.
    log.warn('stripe_subscription_unknown_price', { eventId: event.id, priceId });
    return { status: 200, body: { received: true, ignored: 'unknown price' } };
  }

  // Downgraded/canceled on Stripe's side → mirror locally. past_due keeps
  // paid access; the dunning grace is handled by invoice.payment_failed.
  const downgraded = !['active', 'trialing', 'past_due'].includes(sub.status);

  // Stripe API 2025+ moved the period end from the subscription object to
  // its line items — read it from items with a safe fallback.
  const periodEndSec = sub.items?.data?.[0]?.current_period_end ?? null;

  const payload = downgraded
    ? { subscription_tier: 'free', subscription_expires_at: null, billing_grace_period_until: null }
    : {
        subscription_tier: tier,
        subscription_expires_at:
          periodEndSec !== null ? new Date(periodEndSec * 1000).toISOString() : null,
        billing_grace_period_until: null,
      };

  const { error } = await supabase.from('users').update(payload).eq('id', userId);
  if (error) {
    log.error('stripe_subscription_update_failed', { eventId: event.id, userId, err: serializeErr(error) });
    throw new Error('users update failed for customer.subscription.updated');
  }
  invalidateTierCache(userId);
  return { status: 200, body: { received: true } };
}

async function onSubscriptionDeleted(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<NormalizedResponse> {
  const sub = event.data.object as Stripe.Subscription;
  const userId = await resolveUserId(supabase, {
    metadataUserId: sub.metadata?.userId,
    subscriptionId: sub.id,
    customerId: customerIdOf(sub.customer),
  });
  if (!userId) {
    log.warn('stripe_subscription_deleted_unmatched', { eventId: event.id, subscriptionId: sub.id });
    return { status: 200, body: { received: true, ignored: 'no matching user' } };
  }

  const { error } = await supabase
    .from('users')
    .update({ subscription_tier: 'free', subscription_expires_at: null, billing_grace_period_until: null })
    .eq('id', userId);
  if (error) {
    log.error('stripe_subscription_delete_failed', { eventId: event.id, userId, err: serializeErr(error) });
    throw new Error('users update failed for customer.subscription.deleted');
  }
  invalidateTierCache(userId);
  return { status: 200, body: { received: true } };
}

async function onPaymentFailed(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<NormalizedResponse> {
  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | null;
    parent?: { subscription_details?: { subscription?: string | null } } | null;
  };
  const subscriptionId = invoice.subscription
    ?? invoice.parent?.subscription_details?.subscription
    ?? null;
  const customerId = customerIdOf(invoice.customer);

  const userId = await resolveUserId(supabase, { subscriptionId, customerId });
  if (!userId) {
    log.warn('stripe_payment_failed_unmatched', { eventId: event.id });
    return { status: 200, body: { received: true, ignored: 'no matching user' } };
  }

  // Grace period only — the tier is NOT downgraded here. Stripe retries the
  // charge; customer.subscription.updated/deleted decides the final state.
  const graceUntil = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();
  const { error } = await supabase
    .from('users')
    .update({ billing_grace_period_until: graceUntil })
    .eq('id', userId);
  if (error) {
    log.error('stripe_grace_update_failed', { eventId: event.id, userId, err: serializeErr(error) });
    throw new Error('users update failed for invoice.payment_failed');
  }
  invalidateTierCache(userId);
  return { status: 200, body: { received: true } };
}

/**
 * Entry point for both server runtimes. `payload` MUST be the raw request
 * body (Buffer or string) — not a re-parsed object.
 */
export async function handleStripeWebhook(
  payload: string | Buffer | undefined,
  signature: string | undefined,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  const stripe = getStripe();
  if (!stripe) return notConfigured();

  const event = await verifyStripeSignature(payload, signature);
  if (!event) {
    return {
      status: 400,
      body: { error: 'Webhook signature verification failed', code: 'SIGNATURE_VERIFICATION_FAILED' },
    };
  }

  // Idempotency ledger: claim the event id BEFORE processing. The unique
  // PK (stripe_events.id) makes the claim atomic — a duplicate delivery
  // upserts with ON CONFLICT DO NOTHING (ignoreDuplicates), claims no row
  // and is ACK'd without reprocessing.
  const { data: claimed, error: insertErr } = await supabase
    .from('stripe_events')
    .upsert(
      { id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();

  if (insertErr) {
    log.error('stripe_event_insert_failed', { eventId: event.id, err: serializeErr(insertErr) });
    return { status: 500, body: { error: 'Failed to record webhook event', code: 'EVENT_RECORD_FAILED' } };
  }
  if (!claimed) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        return await onCheckoutCompleted(supabase, event);
      case 'customer.subscription.updated':
        return await onSubscriptionUpdated(supabase, event);
      case 'customer.subscription.deleted':
        return await onSubscriptionDeleted(supabase, event);
      case 'invoice.payment_failed':
        return await onPaymentFailed(supabase, event);
      default:
        return { status: 200, body: { received: true, ignored: event.type } };
    }
  } catch (err) {
    // Release the idempotency claim so Stripe's retry can re-process.
    await supabase.from('stripe_events').delete().eq('id', event.id);
    log.error('stripe_event_process_failed', {
      eventId: event.id,
      type: event.type,
      err: serializeErr(err),
    });
    return { status: 500, body: { error: 'Failed to process webhook event', code: 'EVENT_PROCESS_FAILED' } };
  }
}
