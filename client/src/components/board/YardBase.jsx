import LudoToken from "../LudoToken";
import TokenStack from "./TokenStack";
import { YARD_BG } from "./constants";

/**
 * The coloured 6×6 home yard for one player.
 * Renders a 2×2 grid of token slots; present tokens show as LudoToken pawns,
 * empty slots show as a decorative tinted circle.
 *
 * Props:
 *   color          - "RED" | "BLUE" | "GREEN" | "YELLOW"
 *   tokens         - base tokens array (from getBaseTokens) with tokenIndex, playerIndex
 *   isTokenMovable - (playerIndex, tokenIndex) => boolean
 *   isTokenSelected- (playerIndex, tokenIndex) => boolean
 *   onTokenClick   - (playerIndex, tokenIndex) => void
 */
const YardBase = ({
  color,
  tokens,
  isTokenMovable,
  isTokenSelected,
  onTokenClick,
}) => {
  const bg = YARD_BG[color];

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        backgroundColor: bg,
        padding: "12%",
        border: "1px solid rgba(156,163,175,0.6)",
      }}
    >
      <div
        className="w-full h-full bg-white rounded-lg grid grid-cols-2 grid-rows-2"
        style={{
          gap: "10%",
          padding: "10%",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        {[0, 1, 2, 3].map((slot) => {
          const token = tokens.find((t) => t.tokenIndex === slot);
          const movable = token
            ? isTokenMovable(token.playerIndex, slot)
            : false;

          return (
            <div
              key={slot}
              className="rounded-full flex items-center justify-center bg-white shadow-sm relative overflow-visible"
              style={{ border: `3px solid ${bg}` }}
            >
              {token ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <LudoToken
                    color={color}
                    number={slot}
                    isMovable={movable}
                    isSelected={isTokenSelected(token.playerIndex, slot)}
                    onClick={() => onTokenClick(token.playerIndex, slot)}
                    size="base"
                    inBase
                  />
                </div>
              ) : (
                <div
                  className="w-[65%] h-[65%] rounded-full relative overflow-hidden"
                  style={{ backgroundColor: bg }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/35 to-transparent" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default YardBase;
