-- =====================================================================
-- Migration: Subscription Tiers
-- Adds a `subscription_tier` column to the users table so we can gate
-- premium features (Advisor, Decryptor, Simulation, Dossiers, Field Guide,
-- Calibration) behind paid tiers.
--
-- Tiers:
--   • free       — default; assessment + encyclopedia + glossary only
--   • strategist — full toolkit access
--   • oracle     — strategist + 1:1 coaching (same toolkit access)
--
-- Admin override: `role = 'admin'` bypasses tier checks at the app layer.
-- This column is purely informational at the DB level — feature locking
-- happens in the React route guards, not RLS, so admins always pass through.
-- =====================================================================

-- Add column with safe default. Existing users become free-tier.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT
    NOT NULL
    DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'strategist', 'oracle'));

-- Optional: track when the current subscription period ends, for future
-- Stripe integration. Null means "no active paid subscription / lifetime free".
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Helpful index when we eventually filter admin dashboards by tier.
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier
  ON users(subscription_tier);

-- Helper: is the user a paid subscriber?
-- Returns true if the user is on strategist/oracle AND not expired
-- (or has no expiry set, meaning manually-granted lifetime access).
CREATE OR REPLACE FUNCTION public.has_paid_subscription()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT
        subscription_tier IN ('strategist', 'oracle')
        AND (
          subscription_expires_at IS NULL
          OR subscription_expires_at > NOW()
        )
      FROM public.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;
