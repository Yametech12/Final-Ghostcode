-- =====================================================================
-- Migration: Billing subscriptions (PayPal)
-- Adds tables to record provider subscriptions and processed webhook
-- events. The users.subscription_tier column (added in
-- 20240101000300_subscription_tiers.sql) remains the single source of
-- truth for feature gating; these tables are the audit trail linking a
-- PayPal subscription back to its owning user.
--
-- APPLY VIA: Supabase dashboard SQL editor or `supabase db push`.
-- =====================================================================

-- One row per provider subscription purchased by a user.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paypal' CHECK (provider = 'paypal'),
  provider_subscription_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('strategist', 'oracle')),
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user
  ON billing_subscriptions(user_id);

-- Processed webhook event IDs — guarantees idempotent handling when
-- PayPal retries delivery.
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  provider_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'paypal',
  event_type TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lock down direct writes: only the service role (backend) may write.
-- Mirrors the privilege-escalation guard on users.subscription_tier
-- (20240101000400_security_hardening.sql).
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_subscriptions_no_direct_access ON billing_subscriptions;
CREATE POLICY billing_subscriptions_no_direct_access ON billing_subscriptions
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS billing_webhook_events_no_direct_access ON billing_webhook_events;
CREATE POLICY billing_webhook_events_no_direct_access ON billing_webhook_events
  FOR ALL USING (false) WITH CHECK (false);
