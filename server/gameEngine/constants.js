// Game constants
export const COLORS = ["RED", "BLUE", "GREEN", "YELLOW"];
export const TOKENS_PER_PLAYER = 4;
export const BOARD_SIZE = 52;
export const HOME_ENTRY_OFFSET = 51;
export const WINNING_POSITION = 57; // 52 + 5 home stretch

// Starting positions for each color on the track
export const START_POSITIONS = {
  YELLOW: 0,
  RED: 13,
  GREEN: 26,
  BLUE: 39,
};

// Home entry positions (last track position before entering home column)
export const HOME_ENTRIES = {
  YELLOW: 50,
  RED: 11,
  GREEN: 24,
  BLUE: 37,
};

// Safe positions (cannot be captured) — includes start cells + star cells + home entries
export const SAFE_POSITIONS = [0, 8, 11, 13, 21, 24, 26, 34, 37, 39, 47, 50];

export const DICE_MIN = 1;
export const DICE_MAX = 6;
export const UNLOCK_NUMBER = 6;

// Turn timer in seconds
export const TURN_TIMEOUT = 15;

// Reconnection grace period in seconds
export const RECONNECT_GRACE_PERIOD = 30;

// ── Room / lobby constants ────────────────────────────────────────────────────

/** Color assignment order for a 4-player game */
export const COLOR_ORDER_4 = ["RED", "BLUE", "GREEN", "YELLOW"];

/** Two possible color-pair assignments for a 2-player game (chosen randomly) */
export const COLOR_ORDER_2_OPTIONS = [
  ["YELLOW", "GREEN"],
  ["RED", "BLUE"],
];

/** Minimum connected players required to start a game */
export const MIN_PLAYERS_TO_START = 2;

// ── Server timing ─────────────────────────────────────────────────────────────

/** Delay (ms) before auto-moving a token when only one move is available */
export const AUTO_MOVE_DELAY_MS = 2000;

/** Interval (ms) between player presence heartbeat broadcasts */
export const HEARTBEAT_INTERVAL_MS = 10_000;

// ── Chat / input limits ───────────────────────────────────────────────────────

/** Maximum allowed chat message length in characters */
export const MAX_CHAT_LENGTH = 200;

// ── Avatar pool ───────────────────────────────────────────────────────────────

/** Emoji avatars randomly assigned to new players */
export const AVATARS = [
  "🦁",
  "🐯",
  "🐻",
  "🦊",
  "🐼",
  "🐨",
  "🐸",
  "🐵",
  "🦄",
  "🐲",
  "🦅",
  "🦉",
  "🐺",
  "🦝",
  "🐷",
  "🐮",
];
