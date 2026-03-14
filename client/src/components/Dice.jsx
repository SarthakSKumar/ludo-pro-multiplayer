import { motion } from "framer-motion";
import { useState, useEffect, useCallback, memo, useId } from "react";

// Standard pip positions [x%, y%] — centred via translate(-50%,-50%)
const DOT_POSITIONS = {
  1: [[50, 50]],
  2: [
    [32, 32],
    [68, 68],
  ],
  3: [
    [32, 32],
    [50, 50],
    [68, 68],
  ],
  4: [
    [32, 32],
    [68, 32],
    [32, 68],
    [68, 68],
  ],
  5: [
    [32, 32],
    [68, 32],
    [50, 50],
    [32, 68],
    [68, 68],
  ],
  6: [
    [32, 25],
    [68, 25],
    [32, 50],
    [68, 50],
    [32, 75],
    [68, 75],
  ],
};

// ─── Dice face (SVG 3D isometric — ported from ludo/Dice.tsx) ────────────────
const DiceFace = memo(({ value, isRolling, small }) => {
  const uid = useId();
  // useId returns ":r0:" etc. — strip non-alphanumeric for valid SVG id
  const pfx = `d${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
  const dots = DOT_POSITIONS[value] ?? [];
  const dotR = small ? 3.8 : 5;

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      overflow="visible"
    >
      <defs>
        {/* Main face gradient — ivory surface */}
        <linearGradient id={`${pfx}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F8F8F8" />
          <stop offset="100%" stopColor="#E8E8E8" />
        </linearGradient>

        {/* Right-face edge — amber when rolling, neutral otherwise */}
        <linearGradient id={`${pfx}-right`} x1="0" y1="0" x2="1" y2="1">
          <stop
            offset="0%"
            stopColor={isRolling ? "#D97706" : "#D4D4D4"}
          />
          <stop
            offset="100%"
            stopColor={isRolling ? "#92400E" : "#A3A3A3"}
          />
        </linearGradient>

        {/* Bottom-face edge */}
        <linearGradient id={`${pfx}-bottom`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={isRolling ? "#B45309" : "#BFBFBF"}
          />
          <stop
            offset="100%"
            stopColor={isRolling ? "#78350F" : "#8A8A8A"}
          />
        </linearGradient>

        {/* Dot fill */}
        <radialGradient id={`${pfx}-dot`} cx="0.4" cy="0.35" r="0.6">
          <stop offset="0%" stopColor="#404040" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>

        {/* Drop shadow filter */}
        <filter id={`${pfx}-shadow`} x="-20%" y="-10%" width="140%" height="150%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter={`url(#${pfx}-shadow)`}>
        {/* Bottom face visible edge */}
        <path d="M 14,78 L 14,88 L 74,88 L 74,78 Z" fill={`url(#${pfx}-bottom)`} />

        {/* Right face visible edge */}
        <path d="M 74,18 L 74,88 L 86,80 L 86,10 Z" fill={`url(#${pfx}-right)`} />

        {/* Top/front face */}
        <rect x="14" y="18" width="60" height="60" rx="8" ry="8" fill={`url(#${pfx}-face)`} />

        {/* Face inner border for depth */}
        <rect
          x="14"
          y="18"
          width="60"
          height="60"
          rx="8"
          ry="8"
          fill="none"
          stroke="#D1D5DB"
          strokeWidth="0.8"
        />

        {/* Upper-face gloss overlay */}
        <rect x="16" y="20" width="56" height="28" rx="6" ry="6" fill="white" opacity="0.3" />

        {/* Right-face top-edge highlight */}
        <path d="M 74,18 L 86,10 L 86,12 L 74,20 Z" fill="white" opacity="0.3" />

        {/* Dots */}
        {dots.map(([xPct, yPct], i) => {
          const cx = 14 + (xPct / 100) * 60;
          const cy = 18 + (yPct / 100) * 60;
          return (
            <g key={i}>
              {/* Inset shadow */}
              <circle cx={cx} cy={cy + 0.5} r={dotR} fill="rgba(0,0,0,0.15)" />
              {/* Dot */}
              <circle cx={cx} cy={cy} r={dotR} fill={`url(#${pfx}-dot)`} />
              {/* Specular highlight */}
              <circle cx={cx - 1} cy={cy - 1} r={dotR * 0.4} fill="white" opacity="0.2" />
            </g>
          );
        })}
      </g>
    </svg>
  );
});
DiceFace.displayName = "DiceFace";

// ─── Dice shell ───────────────────────────────────────────────────────────────
const Dice = ({
  value,
  isRolling,
  onRoll,
  disabled,
  size = 80,
  small = false,
}) => {
  const [displayValue, setDisplayValue] = useState(value ?? 1);
  const actualSize = small ? 50 : size;

  // Scramble the face while rolling, then lock to the real result
  useEffect(() => {
    if (isRolling) {
      const iv = setInterval(
        () => setDisplayValue(Math.floor(Math.random() * 6) + 1),
        55
      );
      const to = setTimeout(() => {
        clearInterval(iv);
        setDisplayValue(value ?? 1);
      }, 820);
      return () => {
        clearInterval(iv);
        clearTimeout(to);
      };
    } else {
      setDisplayValue(value ?? 1);
    }
  }, [isRolling, value]);

  const handleClick = useCallback(() => {
    if (!disabled && !isRolling) onRoll?.();
  }, [disabled, isRolling, onRoll]);

  // Coloured rim: now expressed through the SVG right/bottom face gradients.
  // The boxShadow still shows the amber ring when rolling.

  // Amber glow ring when rolling, normal drop-shadow otherwise
  const shadowLayers = isRolling
    ? "0 0 0 2.5px rgba(255,195,0,0.9), 0 0 22px 7px rgba(255,175,0,0.55), 0 8px 24px rgba(0,0,0,0.38)"
    : "0 6px 18px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.22)";

  // 3-axis tumble with a slight size pulse
  const rollAnim = isRolling
    ? {
        rotateX: [0, -200, -400, -600, -720],
        rotateY: [0, 150, 380, 560, 720],
        rotateZ: [0, 60, -80, 40, 0],
        scale: [1, 1.12, 1.06, 1.1, 1],
      }
    : { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 };

  const rollTransition = isRolling
    ? { duration: 0.82, ease: [0.22, 1, 0.36, 1] }
    : { duration: 0.3, ease: "easeOut" };

  return (
    // Perspective wrapper is required for rotateX / rotateY to appear 3-D
    <div style={{ perspective: "800px", width: actualSize, height: actualSize }}>
      <motion.div
        onClick={handleClick}
        animate={rollAnim}
        transition={rollTransition}
        whileHover={
          !disabled && !isRolling
            ? { scale: 1.1, y: -3, transition: { duration: 0.18 } }
            : {}
        }
        whileTap={
          !disabled && !isRolling
            ? { scale: 0.93, transition: { duration: 0.1 } }
            : {}
        }
        style={{
          width: "100%",
          height: "100%",
          borderRadius: small ? "14%" : "16%",
          // SVG is fully self-contained — no background rim or padding needed
          background: "transparent",
          boxShadow: shadowLayers,
          cursor: disabled ? "not-allowed" : isRolling ? "wait" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "box-shadow 0.25s ease",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <DiceFace value={displayValue} isRolling={isRolling} small={small} />
      </motion.div>
    </div>
  );
};

export default Dice;