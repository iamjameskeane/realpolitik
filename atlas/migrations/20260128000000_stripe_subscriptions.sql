-- ════════════════════════════════════════════════════════════════
-- STRIPE SUBSCRIPTION SUPPORT
-- ════════════════════════════════════════════════════════════════
-- Migration: Add Stripe fields for Pro tier subscriptions
-- Purpose: Track subscription status and enable tier-based feature gating

-- ────────────────────────────────────────────────────────────────
-- ADD STRIPE COLUMNS TO PROFILES
-- ────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'
  CHECK (subscription_status IN ('none', 'active', 'canceled', 'past_due'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Index for webhook lookups (find user by Stripe customer ID)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- ────────────────────────────────────────────────────────────────
-- TIER-BASED BRIEFING LIMITS
-- ────────────────────────────────────────────────────────────────

-- Get the daily briefing limit for a given tier
CREATE OR REPLACE FUNCTION get_briefing_limit(user_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE user_tier
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN 200
    ELSE 5  -- free
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update get_briefing_usage to use tier-based limits
-- Must drop first because we're changing the return type (adding limit_value column)
DROP FUNCTION IF EXISTS get_briefing_usage(UUID);

CREATE OR REPLACE FUNCTION get_briefing_usage(user_uuid UUID)
RETURNS TABLE (
    used INTEGER,
    remaining INTEGER,
    limit_value INTEGER,
    resets_at TIMESTAMPTZ
) AS $$
DECLARE
    profile_record RECORD;
    today DATE;
    user_limit INTEGER;
BEGIN
    today := CURRENT_DATE;
    
    SELECT daily_briefings_used, last_briefing_reset, tier
    INTO profile_record
    FROM profiles
    WHERE id = user_uuid;
    
    user_limit := get_briefing_limit(profile_record.tier);
    
    -- Reset if new day
    IF profile_record.last_briefing_reset < today THEN
        UPDATE profiles
        SET daily_briefings_used = 0,
            last_briefing_reset = today
        WHERE id = user_uuid;
        
        RETURN QUERY SELECT 0, user_limit, user_limit, (today + INTERVAL '1 day')::TIMESTAMPTZ;
    ELSE
        RETURN QUERY SELECT 
            profile_record.daily_briefings_used,
            GREATEST(0, user_limit - profile_record.daily_briefings_used),
            user_limit,
            (today + INTERVAL '1 day')::TIMESTAMPTZ;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update increment_briefing_usage to respect tier limits
CREATE OR REPLACE FUNCTION increment_briefing_usage(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    today DATE;
    current_usage INTEGER;
    user_tier TEXT;
    user_limit INTEGER;
BEGIN
    today := CURRENT_DATE;
    
    -- Get current usage and tier
    SELECT daily_briefings_used, tier INTO current_usage, user_tier
    FROM profiles
    WHERE id = user_uuid;
    
    user_limit := get_briefing_limit(user_tier);
    
    -- Check if we need to reset, then increment if under limit
    UPDATE profiles
    SET daily_briefings_used = CASE
        WHEN last_briefing_reset < today THEN 1
        ELSE daily_briefings_used + 1
    END,
    last_briefing_reset = today
    WHERE id = user_uuid
    AND (last_briefing_reset < today OR daily_briefings_used < user_limit);
    
    -- Return true if update succeeded (user had quota)
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────────

COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for subscription management';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN profiles.subscription_status IS 'Subscription status: none, active, canceled, past_due';
COMMENT ON COLUMN profiles.subscription_ends_at IS 'When the current subscription period ends (for canceled subscriptions)';
COMMENT ON FUNCTION get_briefing_limit IS 'Returns daily briefing limit based on tier: free=5, pro=50, enterprise=200';
