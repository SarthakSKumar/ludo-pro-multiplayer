import { motion } from "framer-motion";
import { COLOR_MAP } from "../utils/constants";

const PlayerInfo = ({ player, isCurrentTurn, isCurrentUser, isHost }) => {
  return (
    <motion.div
      className={`card p-4 ${isCurrentTurn ? "" : ""}`}
      style={{ borderColor: COLOR_MAP[player.color], borderWidth: 2 }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg border-4 border-gray-600"
          style={{ backgroundColor: COLOR_MAP[player.color] }}
        >
          {player.avatar}
          {isHost && (
            <span
              className="absolute top-14 text-xs text-black px-1 rounded font-semibold"
              style={{ backgroundColor: COLOR_MAP[player.color] }}
            >
              HOST
            </span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-semibold">
              {player.username}
              {isCurrentUser && (
                <span style={{ color: COLOR_MAP[player.color] }}> (You)</span>
              )}
            </p>

            {!player.connected && (
              <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                Disconnected
              </span>
            )}
          </div>
          <div className="flex gap-1 mt-1">
            {player.ready !== undefined && !player.gameStarted && (
              <span
                className={`text-xs px-2 py-1 rounded ${player.ready ? "bg-emerald-600" : "bg-gray-600"}`}
              >
                {player.ready ? "Ready" : "Not Ready"}
              </span>
            )}
          </div>
        </div>
        {isCurrentTurn && (
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
        )}
      </div>
    </motion.div>
  );
};

export default PlayerInfo;
