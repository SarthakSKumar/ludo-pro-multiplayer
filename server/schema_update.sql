-- ============================================================================
-- Ludo Multiplayer – Schema Migration: Add JWT Auth (users table)
-- Run this AFTER the original schema.sql, in Supabase SQL Editor
-- ============================================================================

-- 1. Create users table -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name     TEXT        NOT NULL,
  last_name      TEXT        NOT NULL,
  username       TEXT        NOT NULL UNIQUE,
  email          TEXT        NOT NULL UNIQUE,
  phone          TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  avatar         TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Clear stale game data (old random UUIDs won't match users) -------------
TRUNCATE game_states, players, rooms CASCADE;

-- 3. Remove username/avatar from players (now sourced from users table) ------
ALTER TABLE players DROP COLUMN IF EXISTS username;
ALTER TABLE players DROP COLUMN IF EXISTS avatar;

-- 4. Add foreign key from players → users -----------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_players_user' AND table_name = 'players'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT fk_players_user FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;
