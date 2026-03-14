-- ============================================================================
-- Ludo Multiplayer – PostgreSQL Schema (run once in Supabase SQL Editor)
-- ============================================================================

-- 1. Rooms ------------------------------------------------------------------
CREATE TABLE rooms (
  code           TEXT        PRIMARY KEY,
  host_user_id   UUID        NOT NULL,
  player_count   INT         NOT NULL DEFAULT 4,
  color_order    TEXT[]      NOT NULL,
  game_started   BOOLEAN     NOT NULL DEFAULT FALSE,
  game_ended     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Players (one row per player-slot in a room) ----------------------------
CREATE TABLE players (
  user_id        UUID        PRIMARY KEY,
  session_id     UUID        NOT NULL UNIQUE,
  room_code      TEXT        NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  socket_id      TEXT,
  username       TEXT        NOT NULL,
  avatar         TEXT        NOT NULL,
  color          TEXT        NOT NULL,
  player_index   INT         NOT NULL,
  ready          BOOLEAN     NOT NULL DEFAULT FALSE,
  connected      BOOLEAN     NOT NULL DEFAULT TRUE,
  left_game      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_players_room   ON players(room_code);
CREATE INDEX idx_players_session ON players(session_id);
CREATE INDEX idx_players_socket  ON players(socket_id);

-- 3. Serialised game-engine state (one row per active game) -----------------
CREATE TABLE game_states (
  room_code      TEXT        PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE,
  engine_state   JSONB       NOT NULL,
  player_count   INT         NOT NULL,
  player_colors  TEXT[]      NOT NULL,
  rankings       INT[]       NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
