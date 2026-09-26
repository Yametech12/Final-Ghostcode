/**
 * Stripe SDK bootstrap + webhook signature verification.
 *
 * Used by both server entries (api/_index.ts in dev, api/server.ts on
 * Vercel). The SDK is initialised lazily and cached so a missing
 * STRIPE_SECRET_KEY degrades gracefully (billing endpoints return 503)
 * instead of crashing the whole API at boot — the rest of the app must
 * keep working while billing is being rolled out.
 *
 * SECURITY: the secret key and webhook secret are server-only. They are
 * never prefixed with VITE_ — vite.config.ts's leak guard fails the build
 * on any VITE_STRIPE_SECRET* variable on purpose.
 */

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;
let stripeInitAttempted = false;

/** Lazily construct (and cache) the Stripe client. Null when unconfigured. */
export function getStripe(): Stripe | null {
  if (stripeInitAttempted) return stripeInstance;
  stripeInitAttempted = true;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('your_') || key.includes('placeholder')) {
    console.warn(
      '[stripe] STRIPE_SECRET_KEY not configured — billing endpoints will return 503.',
    );
    stripeInstance = null;
    return stripeInstance;
  }
  stripeInstance = new Stripe(key);
  return stripeInstance;
}

/** Test/debug helper: drop the cached client so the next call re-reads env. */
export function __resetStripeForTests(): void {
  stripeInstance = null;
  stripeInitAttempted = false;
}

/** True when STRIPE_SECRET_KEY is present and looks real. */
export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}

/**
 * Verify the Stripe-Signature header against the RAW request payload.
 *
 * The raw bytes matter: once express.json()/Vercel's body parser has run,
 * the payload has been re-serialized and the HMAC no longer matches. Both
 * server entries therefore feed this function the untouched body.
 *
 * Returns the parsed event, or null when the signature is missing/invalid
 * or billing is not configured. The caller answers 400 in that case — the
 * payload is never trusted on a null return.
 */
export async function verifyStripeSignature(
  payload: string | Buffer | undefined,
  signature: string | undefined,
): Promise<Stripe.Event | null> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return null;
  if (!signature || payload === undefined || payload === null) return null;

  try {
    // constructEventAsync (not the sync variant) so this also works on
    // runtimes without synchronous crypto for large payloads.
    return await stripe.webhooks.constructEventAsync(
      payload.toString('utf8'),
      signature,
      secret,
    );
  } catch (err) {
    console.warn(
      '[stripe] webhook signature verification failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Map a Stripe Price ID to our subscription tier. The price IDs come from
 * the dashboard and are injected via STRIPE_PRICE_STRATEGIST /
 * STRIPE_PRICE_ORACLE (see .env.example). Unknown/null price → null, and
 * webhook handlers refuse to change a tier they cannot verify.
 */
export function tierFromPriceId(priceId: string | null | undefined): 'strategist' | 'oracle' | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STRATEGIST) return 'strategist';
  if (priceId === process.env.STRIPE_PRICE_ORACLE) return 'oracle';
  return null;
}
