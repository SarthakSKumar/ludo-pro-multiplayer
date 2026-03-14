import { Star } from "lucide-react";
import TokenStack from "./board/TokenStack";
import YardBase from "./board/YardBase";
import CenterTriangles from "./board/CenterTriangles";
import {
  TRACK_POSITIONS,
  SAFE_INDICES,
  START_COLORS,
  COLOR_HEX,
  ARROW_DIRS,
  ARROW_ICON,
  coordToTrack,
  coordToHome,
  hexToRgba,
} from "./board/constants";
import { useGameStore } from "../store/gameStore";

// === COMPONENT ===
const GameBoard = ({
  gameState,
  onTokenClick,
  selectedToken,
  movesAvailable = [],
}) => {
  const moveAnimation = useGameStore((state) => state.moveAnimation);

  if (!gameState || !gameState.players) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-white text-lg animate-pulse">
          Loading game board...
        </div>
      </div>
    );
  }

  // ── Cell-query helpers ────────────────────────────────────────────────────

  const getPlayerByColor = (color) =>
    gameState.players.find((p) => p.color === color);

  const isTokenMovable = (playerIndex, tokenIndex) =>
    movesAvailable.some((m) => m.tokenIndex === tokenIndex) &&
    gameState.currentPlayerIndex === playerIndex;

  const isTokenSelected = (playerIndex, tokenIndex) =>
    selectedToken?.playerIndex === playerIndex &&
    selectedToken?.tokenIndex === tokenIndex;

  const handleClick = (playerIndex, tokenIndex) => {
    if (onTokenClick) onTokenClick(playerIndex, tokenIndex);
  };

  /** Tokens still in base for a colour */
  const getBaseTokens = (color) => {
    const player = getPlayerByColor(color);
    if (!player) return [];
    const playerIndex = gameState.players.indexOf(player);
    return player.tokens
      .map((token, tokenIndex) => ({
        ...token,
        tokenIndex,
        playerIndex,
        color,
      }))
      .filter((t) => t.inBase);
  };

  /** Tokens at a main-track position (0–51) */
  const getTokensAtPosition = (trackIdx) => {
    const tokens = [];
    gameState.players.forEach((player, playerIndex) => {
      player.tokens.forEach((token, tokenIndex) => {
        if (
          !token.inBase &&
          !token.inHome &&
          token.position === trackIdx &&
          token.position < 52
        ) {
          tokens.push({ color: player.color, playerIndex, tokenIndex });
        }
      });
    });
    return tokens;
  };

  /** Tokens in a home-column cell */
  const getHomeTokens = (color, homeIndex) => {
    const player = getPlayerByColor(color);
    if (!player) return [];
    const playerIndex = gameState.players.indexOf(player);
    const targetPos = 52 + homeIndex;
    return player.tokens
      .filter((t) => t.position === targetPos && !t.inBase && !t.inHome)
      .map((token) => ({
        color: player.color,
        playerIndex,
        tokenIndex: player.tokens.indexOf(token),
      }));
  };

  /** Finished tokens (inHome) for a colour, keyed for CenterTriangles */
  const getFinishedTokenList = (color) => {
    const player = getPlayerByColor(color);
    if (!player) return [];
    const playerIndex = gameState.players.indexOf(player);
    return player.tokens
      .map((t, tokenIndex) => ({ ...t, tokenIndex, playerIndex, color }))
      .filter((t) => t.inHome);
  };

  // Shared interaction props forwarded to sub-components
  const tokenInteraction = {
    isTokenMovable,
    isTokenSelected,
    onTokenClick: handleClick,
    moveAnimation,
  };

  // Build finishedByColor for CenterTriangles
  const finishedByColor = {};
  ["RED", "GREEN", "BLUE", "YELLOW"].forEach((c) => {
    finishedByColor[c] = getFinishedTokenList(c);
  });

  // ── Build the 15×15 grid ──────────────────────────────────────────────────
  const cells = [];

  // Merged yard zones (6×6 each corner)
  [
    { key: "yard-yellow", color: "YELLOW", col: "1/7", row: "1/7" },
    { key: "yard-red", color: "RED", col: "10/16", row: "1/7" },
    { key: "yard-blue", color: "BLUE", col: "1/7", row: "10/16" },
    { key: "yard-green", color: "GREEN", col: "10/16", row: "10/16" },
  ].forEach(({ key, color, col, row }) =>
    cells.push(
      <div key={key} style={{ gridColumn: col, gridRow: row }}>
        <YardBase
          color={color}
          tokens={getBaseTokens(color)}
          {...tokenInteraction}
        />
      </div>,
    ),
  );

  // Merged centre 3×3
  cells.push(
    <div key="center" style={{ gridColumn: "7/10", gridRow: "7/10" }}>
      <CenterTriangles finishedByColor={finishedByColor} />
    </div>,
  );

  // Individual cross-arm cells
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      // Skip zones covered by merged divs
      if (row < 6 && col < 6) continue; // YELLOW yard
      if (row < 6 && col > 8) continue; // RED yard
      if (row > 8 && col < 6) continue; // BLUE yard
      if (row > 8 && col > 8) continue; // GREEN yard
      if (row >= 6 && row <= 8 && col >= 6 && col <= 8) continue; // Centre

      const coordKey = `${row},${col}`;
      const trackIdx = coordToTrack[coordKey];
      const homeInfo = coordToHome[coordKey];

      let bgColor = "#FFF8F0";
      let content = null;

      if (trackIdx !== undefined) {
        // Track cell
        const startColor = START_COLORS[trackIdx];
        const arrowDir = ARROW_DIRS[trackIdx];
        const isSafe = SAFE_INDICES.includes(trackIdx);

        if (startColor) bgColor = COLOR_HEX[startColor];

        let indicator = null;
        if (arrowDir) {
          const ArrowIcon = ARROW_ICON[arrowDir];
          indicator = (
            <ArrowIcon
              size={20}
              strokeWidth={3}
              className="opacity-80 drop-shadow-sm"
              style={{ color: startColor ? "#FFFFFF" : "#374151" }}
            />
          );
        } else if (isSafe) {
          indicator = (
            <Star size={25} strokeWidth={1.5} className="opacity-50" />
          );
        }

        content = (
          <>
            {indicator && (
              <span className="absolute z-[5] select-none flex items-center justify-center pointer-events-none">
                {indicator}
              </span>
            )}
            <TokenStack
              tokens={getTokensAtPosition(trackIdx)}
              {...tokenInteraction}
            />
          </>
        );
      } else if (homeInfo) {
        // Home-column cell
        const opacityVal = 0.35 + homeInfo.index * 0.11;
        bgColor = hexToRgba(COLOR_HEX[homeInfo.color], opacityVal);
        content = (
          <TokenStack
            tokens={getHomeTokens(homeInfo.color, homeInfo.index)}
            {...tokenInteraction}
          />
        );
      }

      cells.push(
        <div
          key={`cell-${row}-${col}`}
          className="relative flex items-center justify-center"
          style={{
            gridColumn: col + 1,
            gridRow: row + 1,
            backgroundColor: bgColor,
            border: "0.5px solid rgba(156,163,175,0.5)",
          }}
        >
          {content}
          {` ${trackIdx !== undefined ? `(T${trackIdx})` : ""}${homeInfo ? `(H${homeInfo.color[0]}${homeInfo.index})` : ""}`}
          <div className="absolute inset-[1px] border-t border-l border-white/20 pointer-events-none rounded-[1px]" />
        </div>,
      );
    }
  }

  return (
    <div className="flex justify-center items-center">
      <div
        className="rounded-lg overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(15, 1fr)",
          gridTemplateRows: "repeat(15, 1fr)",
          width: "min(90vw, 600px)",
          aspectRatio: "1 / 1",
          boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
          border: "6px solid #4B5563",
          background: "#FFF8F0",
        }}
      >
        {cells}
      </div>
    </div>
  );
};

export default GameBoard;
