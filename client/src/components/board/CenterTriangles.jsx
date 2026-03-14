import LudoToken from "../LudoToken";
import { COLOR_HEX, CENTER_TOKEN_POSITIONS } from "./constants";

/**
 * The centre 3×3 area — four coloured triangles meeting at a point,
 * with finished player tokens displayed in each quadrant.
 *
 * Props:
 *   finishedByColor - object keyed by color, value is array of
 *                     { tokenIndex, playerIndex, color, ... }
 */
const CenterTriangles = ({ finishedByColor }) => {
  const colors = ["RED", "GREEN", "BLUE", "YELLOW"];

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ border: "1px solid rgba(156,163,175,0.6)" }}
    >
      {/* Four coloured triangles */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      >
        <polygon points="0,0 100,0 50,50" fill={COLOR_HEX.RED} />
        <polygon points="100,0 100,100 50,50" fill={COLOR_HEX.GREEN} />
        <polygon points="100,100 0,100 50,50" fill={COLOR_HEX.BLUE} />
        <polygon points="0,100 0,0 50,50" fill={COLOR_HEX.YELLOW} />
        <line
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="0.8"
        />
        <line
          x1="100"
          y1="0"
          x2="0"
          y2="100"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="0.8"
        />
      </svg>

      {/* Finished tokens positioned inside their colour's quadrant */}
      {colors.map((color) =>
        (finishedByColor[color] || []).map((t, i) => {
          const pos = CENTER_TOKEN_POSITIONS[color][i];
          if (!pos) return null;
          return (
            <div
              key={`${color}-${t.tokenIndex}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
              style={{ left: pos.l, top: pos.t }}
            >
              <LudoToken color={color} number={t.tokenIndex} size="small" />
            </div>
          );
        }),
      )}

      {/* White centre dot */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className="w-[14%] h-[14%] bg-white rounded-full shadow-md" />
      </div>
    </div>
  );
};

export default CenterTriangles;
