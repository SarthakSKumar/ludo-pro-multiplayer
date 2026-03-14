import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

// ── Track layout ──────────────────────────────────────────────────────────────

/** [row, col] for each track position 0–51 */
export const TRACK_POSITIONS = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5], // 0-4
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6], // 5-10
  [0, 7],
  [0, 8], // 11-12
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8], // 13-17
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14], // 18-23
  [7, 14],
  [8, 14], // 24-25
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9], // 26-30
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8], // 31-36
  [14, 7],
  [14, 6], // 37-38
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6], // 39-43
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0], // 44-49
  [7, 0],
  [6, 0], // 50-51
];

/** Home-column cells (5 per color, index 0 = farthest from centre) */
export const HOME_COLUMNS = {
  YELLOW: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  RED: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  GREEN: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  BLUE: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
};

/** Track indices that are safe (star or home-entry) */
export const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

/** Track index → color of the start/entry cell */
export const START_COLORS = { 0: "YELLOW", 13: "RED", 26: "GREEN", 39: "BLUE" };

/** Hex colour for each player */
export const COLOR_HEX = {
  YELLOW: "#EAB308",
  RED: "#DC2626",
  GREEN: "#16A34A",
  BLUE: "#2563EB",
};

/** Background colour for each yard zone (same as player colour) */
export const YARD_BG = COLOR_HEX;

/** Arrow direction for each start-entry cell */
export const ARROW_DIRS = { 0: "right", 13: "down", 26: "left", 39: "up" };

/** Lucide arrow component keyed by direction */
export const ARROW_ICON = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

// ── Pre-computed lookup maps ──────────────────────────────────────────────────

/** "row,col" → track index (0–51) */
export const coordToTrack = {};
TRACK_POSITIONS.forEach(([r, c], idx) => {
  coordToTrack[`${r},${c}`] = idx;
});

/** "row,col" → { color, index } for home-column cells */
export const coordToHome = {};
Object.entries(HOME_COLUMNS).forEach(([color, coords]) => {
  coords.forEach(([r, c], idx) => {
    coordToHome[`${r},${c}`] = { color, index: idx };
  });
});

// ── Utility ───────────────────────────────────────────────────────────────────

/** Convert a hex colour string to rgba for opacity variations */
export const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** % positions of finished-token slots inside each triangle quadrant */
export const CENTER_TOKEN_POSITIONS = {
  RED: [
    { l: "50%", t: "6%" },
    { l: "34%", t: "20%" },
    { l: "58%", t: "20%" },
    { l: "50%", t: "34%" },
  ],
  GREEN: [
    { l: "88%", t: "50%" },
    { l: "72%", t: "34%" },
    { l: "72%", t: "62%" },
    { l: "60%", t: "50%" },
  ],
  BLUE: [
    { l: "50%", t: "88%" },
    { l: "34%", t: "72%" },
    { l: "58%", t: "72%" },
    { l: "50%", t: "60%" },
  ],
  YELLOW: [
    { l: "6%", t: "50%" },
    { l: "22%", t: "34%" },
    { l: "22%", t: "62%" },
    { l: "36%", t: "50%" },
  ],
};
