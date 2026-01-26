-- ════════════════════════════════════════════════════════════════
-- INBOX PREFERENCES (Separate from Push Notifications)
-- ════════════════════════════════════════════════════════════════
-- Migration: Add user-level inbox preferences
-- Purpose: Allow users to configure inbox rules separately from push notifications

-- Add inbox_preferences to user_state
ALTER TABLE user_state 
ADD COLUMN IF NOT EXISTS inbox_preferences JSONB DEFAULT '{
  "enabled": true,
  "rules": [{
    "id": "default",
    "name": "All Events",
    "enabled": true,
    "conditions": []
  }]
}';

-- Function to update inbox preferences
CREATE OR REPLACE FUNCTION update_inbox_preferences(
    user_uuid UUID,
    prefs JSONB
)
RETURNS VOID AS $$
BEGIN
    -- Ensure state exists
    PERFORM ensure_user_state(user_uuid);
    
    -- Update preferences
    UPDATE user_state
    SET inbox_preferences = prefs
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get inbox preferences
CREATE OR REPLACE FUNCTION get_inbox_preferences(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    prefs JSONB;
BEGIN
    SELECT inbox_preferences INTO prefs
    FROM user_state
    WHERE user_id = user_uuid;
    
    -- Return default if not found
    IF prefs IS NULL THEN
        RETURN '{
            "enabled": true,
            "rules": [{
                "id": "default",
                "name": "All Events", 
                "enabled": true,
                "conditions": []
            }]
        }'::JSONB;
    END IF;
    
    RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────────

COMMENT ON COLUMN user_state.inbox_preferences IS 'User-level inbox notification rules (separate from per-device push rules)';
COMMENT ON FUNCTION update_inbox_preferences IS 'Updates user inbox preferences';
COMMENT ON FUNCTION get_inbox_preferences IS 'Gets user inbox preferences with defaults';
