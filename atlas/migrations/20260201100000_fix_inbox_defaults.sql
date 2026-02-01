-- ════════════════════════════════════════════════════════════════
-- FIX INBOX PREFERENCES DEFAULTS
-- ════════════════════════════════════════════════════════════════
-- Migration: Update default inbox preferences to include Critical Events rule
-- Purpose: Free users should get severity 9+ rule by default, not empty rules

-- Define the default preferences JSON
-- This will be used in column default, trigger, and fallback function

-- Update the column default to include the Critical Events rule
ALTER TABLE user_state 
ALTER COLUMN inbox_preferences SET DEFAULT '{
  "enabled": true,
  "rules": [
    {
      "id": "default-critical",
      "name": "Critical Events",
      "enabled": true,
      "sendPush": true,
      "conditions": [
        {"field": "severity", "operator": ">=", "value": 9}
      ]
    }
  ]
}'::JSONB;

-- Update handle_new_user to explicitly set the default preferences
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_prefs JSONB := '{
        "enabled": true,
        "rules": [
            {
                "id": "default-critical",
                "name": "Critical Events",
                "enabled": true,
                "sendPush": true,
                "conditions": [
                    {"field": "severity", "operator": ">=", "value": 9}
                ]
            }
        ]
    }'::JSONB;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  
  -- Create user state with default inbox preferences
  INSERT INTO public.user_state (user_id, inbox_preferences)
  VALUES (NEW.id, default_prefs);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_inbox_preferences to return proper default
CREATE OR REPLACE FUNCTION get_inbox_preferences(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    prefs JSONB;
    default_prefs JSONB := '{
        "enabled": true,
        "rules": [
            {
                "id": "default-critical",
                "name": "Critical Events",
                "enabled": true,
                "sendPush": true,
                "conditions": [
                    {"field": "severity", "operator": ">=", "value": 9}
                ]
            }
        ]
    }'::JSONB;
BEGIN
    SELECT inbox_preferences INTO prefs
    FROM user_state
    WHERE user_id = user_uuid;
    
    -- Return default if not found OR if rules array is empty
    IF prefs IS NULL OR jsonb_array_length(prefs->'rules') = 0 THEN
        RETURN default_prefs;
    END IF;
    
    RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION handle_new_user IS 'Auto-creates profile and user_state with default Critical Events rule when user signs up';
COMMENT ON FUNCTION get_inbox_preferences IS 'Gets user inbox preferences, returns Critical Events (sev 9+) default for new users';
