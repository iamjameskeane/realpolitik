-- ════════════════════════════════════════════════════════════════
-- USER PUSH SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════════
-- Migration: Move push subscriptions from Redis to Supabase
-- Purpose: Link subscriptions to users, enable device management, sync preferences

-- ────────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS TABLE
-- ────────────────────────────────────────────────────────────────

CREATE TABLE user_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Push subscription data (from browser PushSubscription object)
    endpoint TEXT UNIQUE NOT NULL,  -- Unique per device/browser
    p256dh_key TEXT NOT NULL,       -- Public key for encryption
    auth_key TEXT NOT NULL,         -- Auth secret for encryption
    
    -- Device metadata
    device_name TEXT,               -- "iPhone Safari", "Desktop Chrome"
    user_agent TEXT,
    
    -- Notification preferences for this device
    preferences JSONB DEFAULT '{"rules": []}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    
    -- Soft delete (expired subscriptions)
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_push_subs_user ON user_push_subscriptions(user_id);
CREATE INDEX idx_push_subs_endpoint ON user_push_subscriptions(endpoint);
CREATE INDEX idx_push_subs_active ON user_push_subscriptions(user_id, is_active);
CREATE INDEX idx_push_subs_last_active ON user_push_subscriptions(last_active);

-- Enable RLS
ALTER TABLE user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
    ON user_push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
    ON user_push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
    ON user_push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
    ON user_push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────

-- Get all active subscriptions for a user
CREATE OR REPLACE FUNCTION get_user_subscriptions(user_uuid UUID)
RETURNS TABLE (
    id UUID,
    endpoint TEXT,
    p256dh_key TEXT,
    auth_key TEXT,
    device_name TEXT,
    preferences JSONB,
    created_at TIMESTAMPTZ,
    last_active TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.endpoint,
        s.p256dh_key,
        s.auth_key,
        s.device_name,
        s.preferences,
        s.created_at,
        s.last_active
    FROM user_push_subscriptions s
    WHERE s.user_id = user_uuid
    AND s.is_active = TRUE
    ORDER BY s.last_active DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all active subscriptions (for sending notifications)
-- This is called by the worker with service role, not by users
CREATE OR REPLACE FUNCTION get_all_active_subscriptions()
RETURNS TABLE (
    user_id UUID,
    endpoint TEXT,
    p256dh_key TEXT,
    auth_key TEXT,
    preferences JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.user_id,
        s.endpoint,
        s.p256dh_key,
        s.auth_key,
        s.preferences
    FROM user_push_subscriptions s
    WHERE s.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert subscription (update if endpoint exists, insert if new)
CREATE OR REPLACE FUNCTION upsert_push_subscription(
    user_uuid UUID,
    sub_endpoint TEXT,
    sub_p256dh TEXT,
    sub_auth TEXT,
    sub_device_name TEXT,
    sub_user_agent TEXT,
    sub_preferences JSONB
)
RETURNS UUID AS $$
DECLARE
    subscription_id UUID;
BEGIN
    -- Try to update existing subscription with this endpoint
    UPDATE user_push_subscriptions
    SET 
        p256dh_key = sub_p256dh,
        auth_key = sub_auth,
        device_name = sub_device_name,
        user_agent = sub_user_agent,
        preferences = sub_preferences,
        last_active = NOW(),
        is_active = TRUE
    WHERE endpoint = sub_endpoint
    RETURNING id INTO subscription_id;
    
    -- If no existing subscription, insert new one
    IF subscription_id IS NULL THEN
        INSERT INTO user_push_subscriptions (
            user_id,
            endpoint,
            p256dh_key,
            auth_key,
            device_name,
            user_agent,
            preferences
        )
        VALUES (
            user_uuid,
            sub_endpoint,
            sub_p256dh,
            sub_auth,
            sub_device_name,
            sub_user_agent,
            sub_preferences
        )
        RETURNING id INTO subscription_id;
    END IF;
    
    RETURN subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove subscription by endpoint
CREATE OR REPLACE FUNCTION remove_push_subscription(sub_endpoint TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM user_push_subscriptions
    WHERE endpoint = sub_endpoint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark subscription as inactive (soft delete)
CREATE OR REPLACE FUNCTION deactivate_push_subscription(sub_endpoint TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_push_subscriptions
    SET is_active = FALSE
    WHERE endpoint = sub_endpoint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update subscription preferences (notification rules)
CREATE OR REPLACE FUNCTION update_subscription_preferences(
    sub_endpoint TEXT,
    new_preferences JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE user_push_subscriptions
    SET 
        preferences = new_preferences,
        last_active = NOW()
    WHERE endpoint = sub_endpoint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old/inactive subscriptions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete subscriptions inactive for > 90 days
    DELETE FROM user_push_subscriptions
    WHERE last_active < NOW() - INTERVAL '90 days'
    OR (is_active = FALSE AND last_active < NOW() - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────────

COMMENT ON TABLE user_push_subscriptions IS 'Push notification subscriptions linked to user accounts';
COMMENT ON COLUMN user_push_subscriptions.endpoint IS 'Unique push endpoint from browser PushSubscription';
COMMENT ON COLUMN user_push_subscriptions.p256dh_key IS 'Public key for encrypting push payloads (base64)';
COMMENT ON COLUMN user_push_subscriptions.auth_key IS 'Auth secret for encrypting push payloads (base64)';
COMMENT ON COLUMN user_push_subscriptions.device_name IS 'Human-readable device name (e.g., "iPhone Safari")';
COMMENT ON COLUMN user_push_subscriptions.preferences IS 'Notification rules and settings for this device';
COMMENT ON FUNCTION get_all_active_subscriptions IS 'Returns all active subscriptions for sending notifications (worker use only)';
COMMENT ON FUNCTION upsert_push_subscription IS 'Creates or updates a push subscription for a user';
COMMENT ON FUNCTION cleanup_old_subscriptions IS 'Removes stale subscriptions (run via cron)';
