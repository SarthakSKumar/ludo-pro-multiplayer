// Game constants matching server
export const COLORS = ["RED", "BLUE", "GREEN", "YELLOW"];
export const TOKENS_PER_PLAYER = 4;
export const BOARD_SIZE = 52;
export const WINNING_POSITION = 57; // 52 + 5 home stretch cells

export const COLOR_MAP = {
  YELLOW: "#EAB308",
  RED: "#DC2626",
  GREEN: "#16A34A",
  BLUE: "#2563EB",
};

// Track start positions matching server
export const START_POSITIONS = {
  YELLOW: 0,
  RED: 13,
  GREEN: 26,
  BLUE: 39,
};

// Home entry positions — last main-track position before entering home column
export const HOME_ENTRIES = {
  YELLOW: 50,
  RED: 11,
  GREEN: 24,
  BLUE: 37,
};

export const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];

/**
 * Compute every board position a token visits during a single move.
 * Returns an array of positions from the first step to newPosition, inclusive.
 * Mirrors the server's calculateNewPosition logic step-by-step.
 *
 * @param {string} color       - player color key
 * @param {number} fromPos     - current token.position (-1 if inBase)
 * @param {boolean} wasInBase  - true if token was in base before this move
 * @param {number} newPos      - final position after move (from server)
 * @param {number} diceValue   - dice roll
 */
export function computeTokenPath(color, fromPos, wasInBase, newPos, diceValue) {
  if (wasInBase) {
    // Token unlocks from base — just the start position (no step-by-step)
    return [START_POSITIONS[color]];
  }

  const homeEntry = HOME_ENTRIES[color];
  const path = [];
  let cur = fromPos;
  let enteredHomeStretch = cur >= BOARD_SIZE; // already in home stretch?

  for (let step = 0; step < diceValue; step++) {
    if (enteredHomeStretch) {
      // In home column: positions go 52, 53, 54, 55, 56, 57
      cur = cur + 1;
    } else {
      // On main track
      const rawNext = cur + 1;
      if (cur <= homeEntry && rawNext > homeEntry) {
        // Just crossed the home entry — enter home stretch
        const stepsAfterEntry = rawNext - homeEntry;
        cur = BOARD_SIZE + stepsAfterEntry - 1;
        enteredHomeStretch = true;
      } else {
        cur = rawNext % BOARD_SIZE;
      }
    }
    path.push(cur);
  }

  return path;
}

/**
 * Determine movement direction between two board positions.
 * Uses the track layout and home column coordinates.
 * Returns "up" | "down" | "left" | "right" | null.
 */
export function getMoveDirection(
  fromPos,
  toPos,
  color,
  trackPositions,
  homeColumns,
) {
  const getCoord = (pos) => {
    if (pos < BOARD_SIZE) return trackPositions[pos];
    // Home column position
    const homeIdx = pos - BOARD_SIZE;
    const homeCol = homeColumns[color];
    return homeCol?.[homeIdx] ?? null;
  };

  const from = getCoord(fromPos);
  const to = getCoord(toPos);
  if (!from || !to) return null;

  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  if (Math.abs(dr) >= Math.abs(dc)) {
    return dr > 0 ? "down" : "up";
  }
  return dc > 0 ? "right" : "left";
}

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
