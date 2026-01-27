-- ════════════════════════════════════════════════════════════════
-- USER AUTHENTICATION & PROFILES
-- ════════════════════════════════════════════════════════════════
-- Migration: Add user authentication support
-- Purpose: Enable user accounts, profiles, and per-user feature tracking

-- ────────────────────────────────────────────────────────────────
-- PROFILES TABLE
-- ────────────────────────────────────────────────────────────────
-- Linked to Supabase auth.users, auto-created on signup

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    
    -- Briefing usage tracking
    daily_briefings_used INTEGER DEFAULT 0,
    last_briefing_reset DATE DEFAULT CURRENT_DATE,
    
    -- User preferences (JSON blob for flexibility)
    preferences JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_tier ON profiles(tier);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE TRIGGER
-- ────────────────────────────────────────────────────────────────
-- Automatically create a profile when a user signs up

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────────
-- UPDATE REACTIONS TABLE
-- ────────────────────────────────────────────────────────────────
-- Add user_id support while maintaining backward compatibility with IP hashing

ALTER TABLE reactions ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Index for user-based queries
CREATE INDEX idx_reactions_user ON reactions(user_id);

-- Enable RLS on reactions (if not already enabled)
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reaction counts
CREATE POLICY "Anyone can read reactions"
    ON reactions FOR SELECT
    USING (true);

-- Authenticated users can insert their own reactions
CREATE POLICY "Users can insert own reactions"
    ON reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own reactions
CREATE POLICY "Users can update own reactions"
    ON reactions FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
    ON reactions FOR DELETE
    USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- UPDATED REACTION COUNTS VIEW
-- ────────────────────────────────────────────────────────────────
-- Recreate the view to work with both user_id and user_fingerprint

DROP VIEW IF EXISTS reaction_counts CASCADE;

CREATE VIEW reaction_counts AS
SELECT 
    event_id,
    COUNT(*) FILTER (WHERE reaction_type = 'critical') AS critical,
    COUNT(*) FILTER (WHERE reaction_type = 'market') AS market,
    COUNT(*) FILTER (WHERE reaction_type = 'noise') AS noise,
    COUNT(*) AS total
FROM reactions
GROUP BY event_id;

-- Grant access to anon users (for read-only access)
GRANT SELECT ON reaction_counts TO anon;
GRANT SELECT ON reaction_counts TO authenticated;

-- Recreate events_with_reactions view (was dropped by CASCADE)
CREATE VIEW events_with_reactions AS
SELECT 
    e.*,
    COALESCE(r.critical, 0) as reactions_critical,
    COALESCE(r.market, 0) as reactions_market,
    COALESCE(r.noise, 0) as reactions_noise,
    COALESCE(r.total, 0) as reactions_total
FROM events e
LEFT JOIN reaction_counts r ON e.id::uuid = r.event_id;

GRANT SELECT ON events_with_reactions TO anon;
GRANT SELECT ON events_with_reactions TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────────

-- Function to get user's current briefing usage
CREATE OR REPLACE FUNCTION get_briefing_usage(user_uuid UUID)
RETURNS TABLE (
    used INTEGER,
    remaining INTEGER,
    resets_at TIMESTAMPTZ
) AS $$
DECLARE
    profile_record RECORD;
    today DATE;
BEGIN
    today := CURRENT_DATE;
    
    SELECT daily_briefings_used, last_briefing_reset
    INTO profile_record
    FROM profiles
    WHERE id = user_uuid;
    
    -- Reset if new day
    IF profile_record.last_briefing_reset < today THEN
        UPDATE profiles
        SET daily_briefings_used = 0,
            last_briefing_reset = today
        WHERE id = user_uuid;
        
        RETURN QUERY SELECT 0, 10, (today + INTERVAL '1 day')::TIMESTAMPTZ;
    ELSE
        RETURN QUERY SELECT 
            profile_record.daily_briefings_used,
            GREATEST(0, 10 - profile_record.daily_briefings_used),
            (today + INTERVAL '1 day')::TIMESTAMPTZ;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment briefing usage
CREATE OR REPLACE FUNCTION increment_briefing_usage(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    today DATE;
    current_usage INTEGER;
BEGIN
    today := CURRENT_DATE;
    
    -- Get current usage, reset if needed
    SELECT daily_briefings_used INTO current_usage
    FROM profiles
    WHERE id = user_uuid;
    
    -- Check if we need to reset
    UPDATE profiles
    SET daily_briefings_used = CASE
        WHEN last_briefing_reset < today THEN 1
        ELSE daily_briefings_used + 1
    END,
    last_briefing_reset = today
    WHERE id = user_uuid
    AND (last_briefing_reset < today OR daily_briefings_used < 10);
    
    -- Return true if update succeeded (user had quota)
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────────

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase Auth';
COMMENT ON COLUMN profiles.tier IS 'Subscription tier: free (10 briefings/day), pro (unlimited), enterprise (custom)';
COMMENT ON COLUMN profiles.daily_briefings_used IS 'Number of briefings used today (resets daily)';
COMMENT ON COLUMN profiles.preferences IS 'User preferences (notification rules, display settings, etc.)';
COMMENT ON COLUMN reactions.user_id IS 'User ID for authenticated reactions (NULL for legacy IP-based reactions)';
COMMENT ON FUNCTION handle_new_user IS 'Auto-creates profile when user signs up via Supabase Auth';
COMMENT ON FUNCTION get_briefing_usage IS 'Returns current briefing usage and remaining quota for a user';
COMMENT ON FUNCTION increment_briefing_usage IS 'Increments briefing usage, returns false if quota exceeded';
