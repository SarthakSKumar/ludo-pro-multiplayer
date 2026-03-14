import { motion } from "framer-motion";
import Confetti from "react-confetti";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { COLOR_MAP } from "../utils/constants";
import {
  Trophy,
  PartyPopper,
  Crown,
  LogOut,
  Medal,
  Award,
  Hash,
  Frown,
} from "lucide-react";

const RANK_ICONS = [
  <Trophy className="w-5 h-5 text-yellow-400" />,
  <Medal className="w-5 h-5 text-gray-300" />,
  <Award className="w-5 h-5 text-amber-600" />,
  <Hash className="w-5 h-5 text-gray-400" />,
];

const WinnerModal = ({
  isOpen,
  winner,
  rankings,
  myPlayerIndex,
  onPlayAgain,
  onLeave,
}) => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!winner) return null;

  // Determine if the current user is the winner
  const isWinner = rankings?.[0]?.playerIndex === myPlayerIndex;

  return (
    <>
      {isOpen && isWinner && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      <Modal isOpen={isOpen} showClose={false}>
        <motion.div
          initial={{ scale: 0, rotate: isWinner ? -180 : 0 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="text-center"
        >
          <div className="mb-6">
            <motion.div
              className="text-8xl mx-auto w-32 h-32 rounded-full flex items-center justify-center shadow-2xl mb-4"
              style={{ backgroundColor: COLOR_MAP[winner.color] }}
              animate={
                isWinner
                  ? { scale: [1, 1.2, 1], rotate: [0, 360] }
                  : { scale: [1, 1.05, 1] }
              }
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {winner.avatar}
            </motion.div>

            {isWinner ? (
              <>
                <h2 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                  <PartyPopper className="w-10 h-10 text-emerald-400" />
                  <Trophy className="w-10 h-10 text-emerald-400" />
                  Winner!
                  <Trophy className="w-10 h-10 text-emerald-400" />
                  <PartyPopper className="w-10 h-10 text-emerald-400" />
                </h2>
                <p className="text-2xl text-white">{winner.username}</p>
                <p className="text-gray-400 mt-2">
                  Congratulations on your victory!
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                  <Frown className="w-8 h-8 text-red-400" />
                  Game Over
                  <Frown className="w-8 h-8 text-red-400" />
                </h2>
                <p className="text-lg text-gray-300">
                  <span className="font-semibold text-white">
                    {winner.username}
                  </span>{" "}
                  won the game
                </p>
                <p className="text-gray-400 mt-2 text-sm">
                  Better luck next time!
                </p>
              </>
            )}
          </div>

          {/* Rankings list — shown when multiple players have finished */}
          {rankings && rankings.length > 1 && (
            <div className="mb-5 text-left">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 text-center">
                Final Rankings
              </h3>
              <div className="space-y-2">
                {rankings.map((player, i) => {
                  const isMe = player.playerIndex === myPlayerIndex;
                  return (
                    <div
                      key={player.playerIndex ?? i}
                      className={[
                        "flex items-center gap-3 px-3 py-2 rounded-lg border",
                        isMe
                          ? "bg-emerald-900/40 border-emerald-500/50"
                          : "bg-gray-800/60 border-gray-700/50",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-center w-6">
                        {RANK_ICONS[i] ?? (
                          <span className="text-sm text-gray-400 font-medium">
                            {i + 1}.
                          </span>
                        )}
                      </span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base shadow"
                        style={{ backgroundColor: COLOR_MAP[player.color] }}
                      >
                        {player.avatar}
                      </div>
                      <span className="text-white text-sm font-medium flex-1 truncate">
                        {player.username}
                        {isMe && (
                          <span className="ml-1 text-xs text-gray-400">
                            (you)
                          </span>
                        )}
                      </span>
                      {i === 0 && <Crown className="w-4 h-4 text-yellow-400" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={onPlayAgain} variant="success">
              Play Again
            </Button>
            <Button
              onClick={onLeave}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <LogOut size={18} />
              Exit Game
            </Button>
          </div>
        </motion.div>
      </Modal>
    </>
  );
};

export default WinnerModal;
