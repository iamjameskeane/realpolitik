-- ════════════════════════════════════════════════════════════════
-- USER STATE TRACKING
-- ════════════════════════════════════════════════════════════════
-- Migration: Add cross-device state sync
-- Purpose: Track notification inbox, read events, and last visit across devices

-- ────────────────────────────────────────────────────────────────
-- USER STATE TABLE
-- ────────────────────────────────────────────────────────────────
-- Stores per-user global state (last visit, settings, etc.)

CREATE TABLE user_state (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Last visit tracking for "What's New"
    last_visit TIMESTAMPTZ DEFAULT NOW(),
    
    -- UI preferences (theme, map settings, etc.)
    ui_preferences JSONB DEFAULT '{}',
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_user_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_state_updated_at
    BEFORE UPDATE ON user_state
    FOR EACH ROW
    EXECUTE FUNCTION update_user_state_timestamp();

-- Enable RLS
ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own state
CREATE POLICY "Users can manage own state"
    ON user_state FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- NOTIFICATION INBOX TABLE
-- ────────────────────────────────────────────────────────────────
-- Tracks which events are in the user's notification inbox

CREATE TABLE user_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- When this was added to inbox (from push notification)
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, event_id)
);

-- Index for efficient lookups
CREATE INDEX idx_user_inbox_user ON user_inbox(user_id);
CREATE INDEX idx_user_inbox_event ON user_inbox(event_id);
CREATE INDEX idx_user_inbox_added_at ON user_inbox(added_at DESC);

-- Enable RLS
ALTER TABLE user_inbox ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own inbox
CREATE POLICY "Users can manage own inbox"
    ON user_inbox FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- READ EVENTS TABLE
-- ────────────────────────────────────────────────────────────────
-- Tracks which events the user has read/clicked

CREATE TABLE user_read_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- When they read it
    read_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, event_id)
);

-- Index for efficient lookups
CREATE INDEX idx_user_read_events_user ON user_read_events(user_id);
CREATE INDEX idx_user_read_events_event ON user_read_events(event_id);
CREATE INDEX idx_user_read_events_read_at ON user_read_events(read_at DESC);

-- Enable RLS
ALTER TABLE user_read_events ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own read events
CREATE POLICY "Users can manage own read events"
    ON user_read_events FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────

-- Initialize user state on first login
CREATE OR REPLACE FUNCTION ensure_user_state(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_state (user_id)
    VALUES (user_uuid)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update last visit timestamp
CREATE OR REPLACE FUNCTION update_last_visit(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Ensure state exists
    PERFORM ensure_user_state(user_uuid);
    
    -- Update timestamp
    UPDATE user_state
    SET last_visit = NOW()
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add event to inbox
CREATE OR REPLACE FUNCTION add_to_inbox(user_uuid UUID, evt_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_inbox (user_id, event_id)
    VALUES (user_uuid, evt_id)
    ON CONFLICT (user_id, event_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove event from inbox
CREATE OR REPLACE FUNCTION remove_from_inbox(user_uuid UUID, evt_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM user_inbox
    WHERE user_id = user_uuid AND event_id = evt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear entire inbox
CREATE OR REPLACE FUNCTION clear_inbox(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM user_inbox
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark event as read
CREATE OR REPLACE FUNCTION mark_event_read(user_uuid UUID, evt_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_read_events (user_id, event_id)
    VALUES (user_uuid, evt_id)
    ON CONFLICT (user_id, event_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark multiple events as read
CREATE OR REPLACE FUNCTION mark_events_read(user_uuid UUID, evt_ids UUID[])
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_read_events (user_id, event_id)
    SELECT user_uuid, unnest(evt_ids)
    ON CONFLICT (user_id, event_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's "new events" (since last visit)
CREATE OR REPLACE FUNCTION get_new_events(user_uuid UUID)
RETURNS TABLE (event_id UUID) AS $$
BEGIN
    -- Ensure state exists
    PERFORM ensure_user_state(user_uuid);
    
    -- Return events newer than last visit
    RETURN QUERY
    SELECT n.id
    FROM nodes n
    WHERE n.type = 'event'
    AND n.created_at > (
        SELECT last_visit
        FROM user_state
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- AUTO-CREATE STATE ON SIGNUP
-- ────────────────────────────────────────────────────────────────
-- Update the existing user creation trigger to also create state

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  
  -- Create user state
  INSERT INTO public.user_state (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────────

COMMENT ON TABLE user_state IS 'Per-user global state (last visit, preferences, etc.)';
COMMENT ON TABLE user_inbox IS 'Notification inbox - events that arrived via push notifications';
COMMENT ON TABLE user_read_events IS 'Tracks which events the user has clicked/read';
COMMENT ON FUNCTION update_last_visit IS 'Updates user last visit timestamp for "What''s New" detection';
COMMENT ON FUNCTION add_to_inbox IS 'Adds an event to user notification inbox (called when push notification received)';
COMMENT ON FUNCTION mark_event_read IS 'Marks an event as read when user clicks it';
COMMENT ON FUNCTION get_new_events IS 'Returns event IDs that are new since user last visit';
