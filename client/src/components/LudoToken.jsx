// LudoToken.jsx — Premium SVG pawn, drop-in replacement.
// All existing props (color, number, isMovable, isSelected, onClick, size, inBase, bounceDirection) preserved.

const PALETTE = {
  BLUE: {
    dark: "#1E3A8A",
    mid: "#2563EB",
    light: "#3B82F6",
    bright: "#93C5FD",
    rim: "#172554",
    shadow: "rgba(37,99,235,0.5)",
    glow: "rgba(59,130,246,0.6)",
  },
  RED: {
    dark: "#7F1D1D",
    mid: "#DC2626",
    light: "#EF4444",
    bright: "#FCA5A5",
    rim: "#450A0A",
    shadow: "rgba(185,28,28,0.5)",
    glow: "rgba(239,68,68,0.6)",
  },
  YELLOW: {
    dark: "#78350F",
    mid: "#D97706",
    light: "#F59E0B",
    bright: "#FDE68A",
    rim: "#451A03",
    shadow: "rgba(217,119,6,0.5)",
    glow: "rgba(245,158,11,0.6)",
  },
  GREEN: {
    dark: "#064E3B",
    mid: "#059669",
    light: "#10B981",
    bright: "#6EE7B7",
    rim: "#022C22",
    shadow: "rgba(5,150,105,0.5)",
    glow: "rgba(16,185,129,0.6)",
  },
};

const SIZE_PX = { small: 22, normal: 30, base: 30, large: 38 };

// CSS keyframe translate for directional bounce hop
const BOUNCE_TRANSLATE = {
  up: "translateY(-20%)",
  down: "translateY(20%)",
  left: "translateX(-20%)",
  right: "translateX(20%)",
};

const LudoToken = ({
  color = "BLUE",
  number = 0,
  isMovable = false,
  isSelected = false,
  onClick,
  size = "normal",
  inBase = false,
  bounceDirection = null,
}) => {
  const p = PALETTE[color] || PALETTE.BLUE;
  const px = SIZE_PX[size] || SIZE_PX.normal;
  // Gradient IDs are per-color — safe because same-color tokens share identical gradients
  const gid = `lt-${color}`;
  const canClick = isMovable && !!onClick;

  // Build bounce animation style when direction is present
  const bounceStyle = bounceDirection
    ? {
        animation: "token-hop 220ms ease-out",
        "--hop-translate":
          BOUNCE_TRANSLATE[bounceDirection] || "translateY(-20%)",
      }
    : {};

  return (
    <div
      onClick={canClick ? onClick : undefined}
      className={[
        "relative flex-shrink-0 select-none transition-transform duration-150",
        canClick ? "cursor-pointer" : "cursor-default",
        isSelected
          ? "scale-125 -translate-y-0.5 z-30"
          : isMovable
            ? "z-20"
            : "z-10",
      ].join(" ")}
      style={{
        width: px,
        height: px,
        filter: isSelected
          ? `drop-shadow(0 0 7px ${p.glow}) drop-shadow(0 2px 5px ${p.shadow})`
          : `drop-shadow(0 2px 3px ${p.shadow})`,
        ...bounceStyle,
      }}
    >
      {isMovable && !isSelected && (
        <div
          className="absolute -inset-1 rounded-full animate-ping pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${p.glow}, transparent 90%)`,
            zIndex: 2,
          }}
        />
      )}
      <svg
        viewBox="0 0 100 125"
        width={px}
        height={px}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={`${gid}-body`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor={p.bright} />
            <stop offset="30%" stopColor={p.light} />
            <stop offset="70%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.dark} />
          </linearGradient>
          <radialGradient id={`${gid}-head`} cx="0.38" cy="0.32" r="0.55">
            <stop offset="0%" stopColor={p.bright} />
            <stop offset="45%" stopColor={p.light} />
            <stop offset="100%" stopColor={p.dark} />
          </radialGradient>
          <linearGradient id={`${gid}-base`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.mid} />
            <stop offset="100%" stopColor={p.rim} />
          </linearGradient>
          <linearGradient id={`${gid}-gloss`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.48" />
            <stop offset="45%" stopColor="white" stopOpacity="0.07" />
            <stop offset="100%" stopColor="black" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="50" cy="121" rx="27" ry="4" fill="rgba(0,0,0,0.18)" />

        {/* Base platform */}
        <ellipse
          cx="50"
          cy="112"
          rx="30"
          ry="9"
          fill={`url(#${gid}-base)`}
          stroke={p.rim}
          strokeWidth="0.8"
        />
        <ellipse cx="50" cy="110" rx="27" ry="7" fill={p.mid} opacity="0.5" />

        {/* Body — curved pawn silhouette */}
        <path
          d="M 27,110 Q 23,83 33,57 Q 39,42 50,32 Q 61,42 67,57 Q 77,83 73,110 Z"
          fill={`url(#${gid}-body)`}
          stroke={p.dark}
          strokeWidth="0.6"
        />

        {/* Gloss overlay on body */}
        <path
          d="M 27,110 Q 23,83 33,57 Q 39,42 50,32 Q 61,42 67,57 Q 77,83 73,110 Z"
          fill={`url(#${gid}-gloss)`}
        />

        {/* Left edge highlight streak */}
        <path
          d="M 34,103 Q 29,78 36,58 Q 40,46 50,36"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.26"
        />

        {/* Neck ring */}
        <ellipse
          cx="50"
          cy="40"
          rx="13"
          ry="3.5"
          fill={p.dark}
          opacity="0.32"
        />

        {/* Head sphere */}
        <circle
          cx="50"
          cy="25"
          r="17"
          fill={`url(#${gid}-head)`}
          stroke={p.dark}
          strokeWidth="0.7"
        />

        {/* Head gloss */}
        <ellipse cx="43" cy="18" rx="8" ry="6" fill="white" opacity="0.36" />

        {/* Specular dot */}
        <circle cx="41" cy="15" r="2.8" fill="white" opacity="0.65" />

        {/* Crown ring when selected */}
        {isSelected && (
          <circle
            cx="50"
            cy="25"
            r="21"
            fill="none"
            stroke="white"
            strokeWidth="3"
            opacity="0.9"
          />
        )}
      </svg>
    </div>
  );
};

export default LudoToken;
