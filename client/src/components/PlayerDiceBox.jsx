import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Dice from "./Dice";
import { COLOR_MAP } from "../utils/constants";

const COLOR_STYLES = {
  GREEN: {
    bg: "bg-green-500",
    border: "border-green-400",
    ring: "ring-green-400",
    text: "text-green-400",
  },
  YELLOW: {
    bg: "bg-yellow-400",
    border: "border-yellow-300",
    ring: "ring-yellow-300",
    text: "text-yellow-400",
  },
  RED: {
    bg: "bg-red-500",
    border: "border-red-400",
    ring: "ring-red-400",
    text: "text-red-400",
  },
  BLUE: {
    bg: "bg-blue-500",
    border: "border-blue-400",
    ring: "ring-blue-400",
    text: "text-blue-400",
  },
};

function getTimerColor(fraction) {
  if (fraction > 0.5) return "#22c55e"; // green
  if (fraction > 0.2) return "#f59e0b"; // yellow/amber
  return "#ef4444"; // red
}

const PlayerDiceBox = ({
  player,
  isCurrentTurn,
  isMe,
  canRoll,
  diceValue,
  isRolling,
  onRoll,
  turnExpiresAt,
  presenceStatus,
  isHost,
}) => {
  const [fraction, setFraction] = useState(0);
  const rafRef = useRef(null);

  // Real-time timer tick — updates via requestAnimationFrame
  useEffect(() => {
    if (!isCurrentTurn || !turnExpiresAt) {
      setFraction(0);
      return;
    }

    const totalDuration = 15000; // match TURN_TIMEOUT

    const tick = () => {
      const remaining = Math.max(0, turnExpiresAt - Date.now());
      setFraction(remaining / totalDuration);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isCurrentTurn, turnExpiresAt]);

  if (!player) return null;

  const styles = COLOR_STYLES[player.color] || COLOR_STYLES.RED;

  // Presence dot color
  const presenceColor =
    presenceStatus === "active"
      ? "bg-green-500"
      : presenceStatus === "away"
        ? "bg-amber-500"
        : "bg-gray-500";

  const timerColor = getTimerColor(fraction);
  // conic-gradient progress border: filled portion = fraction of perimeter
  const progressPercent = Math.min(1, Math.max(0, fraction)) * 100;
  const borderGradient =
    isCurrentTurn && turnExpiresAt
      ? `conic-gradient(${timerColor} ${progressPercent}%, transparent ${progressPercent}%)`
      : "none";

  return (
    <div className="relative">
      {/* Border progress indicator — a 2px "moving border" around the box */}
      {isCurrentTurn && turnExpiresAt && (
        <div
          className="absolute -inset-[2px] rounded-xl pointer-events-none z-0"
          style={{
            background: borderGradient,
          }}
        />
      )}

      <motion.div
        className={`
          relative z-10 flex flex-row items-center gap-2 p-3 rounded-xl
          ${isCurrentTurn ? `ring-2 ${styles.ring} ring-opacity-50 bg-gray-800/90` : "bg-gray-800/60 opacity-75"}
        `}
        animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {/* Presence dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${presenceColor}`} />

        {/* Dice */}
        <Dice
          value={isCurrentTurn ? diceValue : null}
          isRolling={isCurrentTurn && isRolling}
          onRoll={canRoll ? onRoll : undefined}
          disabled={!canRoll}
          small
        />

        {/* Player name + avatar */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ backgroundColor: COLOR_MAP[player.color] }}
          >
            {player.avatar}
          </div>
          <div className="min-w-0">
            <p
              className={`text-xs font-semibold truncate ${isCurrentTurn ? "text-white" : "text-gray-400"}`}
            >
              {player.username}
              {isMe && <span className={`${styles.text} ml-0.5`}> (You)</span>}
            </p>
            {isHost && (
              <span
                className="text-[10px] px-1 rounded font-semibold text-black"
                style={{ backgroundColor: COLOR_MAP[player.color] }}
              >
                HOST
              </span>
            )}
            {!player.connected && (
              <span className="text-[10px] text-red-400">Disconnected</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PlayerDiceBox;
