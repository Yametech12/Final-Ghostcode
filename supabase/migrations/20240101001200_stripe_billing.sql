-- =====================================================================
-- Migration: Stripe Billing
-- Adds Stripe customer/subscription bookkeeping to the users table and
-- an idempotency ledger for webhook events.
--
-- Columns added to users:
--   • stripe_customer_id         — Stripe Customer linked to this user
--   • stripe_subscription_id     — active/pending subscription, if any
--   • billing_grace_period_until — set by invoice.payment_failed; the tier
--     is NOT downgraded while this window is open. A later
--     customer.subscription.updated/deleted decides the final state.
--
-- stripe_events: every processed Stripe webhook event id (PRIMARY KEY).
-- handleStripeWebhook() INSERTs the event id (ON CONFLICT DO NOTHING)
-- BEFORE processing; a duplicate delivery claims no row → ACK'd and
-- skipped. This makes webhook processing exactly-once per event id.
--
-- Naming follows the repo convention: 20240101001200_stripe_billing.sql
-- (numeric prefix continues the 2024010100XXXX series).
-- =====================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS billing_grace_period_until TIMESTAMPTZ;

-- Lookups used by webhook user resolution (subscription → user, customer → user).
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON users(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id
  ON users(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE stripe_events IS
  'Stripe webhook events already processed — idempotency ledger (service role only)';

-- RLS on: the table is written/read exclusively by the API using the
-- service-role key (which bypasses RLS). No policies exist, so anon and
-- authenticated roles can never read the raw webhook payloads.
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
