-- Migration: Complete transition from user_fingerprint to user_id for reactions
--
-- The reactions system now requires authenticated users. This migration:
-- 1. Drops the legacy user_fingerprint column (and its constraint)
-- 2. Makes user_id the primary identifier alongside event_id
--
-- Note: The users migration (20260126195358) already added user_id as nullable.
-- This migration completes the transition.

-- ============================================================================
-- UPDATE REACTIONS TABLE
-- ============================================================================

-- Drop the old primary key constraint (event_id, user_fingerprint)
ALTER TABLE reactions DROP CONSTRAINT reactions_pkey;

-- Delete any legacy reactions that don't have a user_id
-- (These were from the old IP fingerprint system)
DELETE FROM reactions WHERE user_id IS NULL;

-- Drop the legacy user_fingerprint column
ALTER TABLE reactions DROP COLUMN IF EXISTS user_fingerprint;

-- Make user_id NOT NULL now that it's required
ALTER TABLE reactions ALTER COLUMN user_id SET NOT NULL;

-- Create new primary key on (event_id, user_id)
ALTER TABLE reactions ADD PRIMARY KEY (event_id, user_id);

-- Update comments
COMMENT ON COLUMN reactions.user_id IS 'Authenticated user ID (references profiles.id)';
