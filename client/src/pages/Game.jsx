import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Volume2, VolumeX } from "lucide-react";
import GameBoard from "../components/GameBoard";
import Button from "../components/Button";
import PlayerDiceBox from "../components/PlayerDiceBox";
import Chat from "../components/Chat";
import WinnerModal from "../components/WinnerModal";
import { useSocketStore } from "../store/socketStore";
import { useGameStore } from "../store/gameStore";
import { useUserStore } from "../store/userStore";
import { soundManager } from "../utils/sounds";
import {
  computeTokenPath,
  SAFE_POSITIONS,
  getMoveDirection,
} from "../utils/constants";
import { TRACK_POSITIONS, HOME_COLUMNS } from "../components/board/constants";

const Game = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const socket = useSocketStore((state) => state.socket);
  const connected = useSocketStore((state) => state.connected);
  const connectionStatus = useSocketStore((state) => state.connectionStatus);
  const emit = useSocketStore((state) => state.emit);
  const waitForConnection = useSocketStore((state) => state.waitForConnection);
  const on = useSocketStore((state) => state.on);
  const off = useSocketStore((state) => state.off);

  const room = useGameStore((state) => state.room);
  const gameState = useGameStore((state) => state.gameState);
  const username = useUserStore((state) => state.username);
  const rejoinAttempted = useRef(false);
  const diceValue = useGameStore((state) => state.diceValue);
  const isRolling = useGameStore((state) => state.isRolling);
  const chatMessages = useGameStore((state) => state.chatMessages);
  const movesAvailable = useGameStore((state) => state.movesAvailable);
  const turnExpiresAt = useGameStore((state) => state.turnExpiresAt);
  const playersStatus = useGameStore((state) => state.playersStatus);
  const setRoom = useGameStore((state) => state.setRoom);
  const setGameState = useGameStore((state) => state.setGameState);
  const setDiceValue = useGameStore((state) => state.setDiceValue);
  const setIsRolling = useGameStore((state) => state.setIsRolling);
  const setMovesAvailable = useGameStore((state) => state.setMovesAvailable);
  const setTurnExpiresAt = useGameStore((state) => state.setTurnExpiresAt);
  const setPlayersStatus = useGameStore((state) => state.setPlayersStatus);
  const addChatMessage = useGameStore((state) => state.addChatMessage);
  const setWinnerStore = useGameStore((state) => state.setWinner);
  const setRankings = useGameStore((state) => state.setRankings);
  const rankings = useGameStore((state) => state.rankings);
  const setMoveAnimation = useGameStore((state) => state.setMoveAnimation);

  // ROAST #8: pull setters from hook instead of using getState() for writes
  const setCurrentRoomCode = useUserStore((state) => state.setCurrentRoomCode);
  const setSession = useUserStore((state) => state.setSession);

  const selectedToken = useGameStore((state) => state.selectedToken);
  const setSelectedToken = useGameStore((state) => state.setSelectedToken);
  const winner = useGameStore((state) => state.winner);
  const showWinner = !!winner;
  const [error, setError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.enabled);

  // Keep last dice value in a ref so token-moved handler can read it without stale closure
  const lastDiceValueRef = useRef(null);

  // Animation-in-progress flag + queued events that must wait for animation to finish
  const animatingRef = useRef(false);
  const pendingEventsRef = useRef([]);

  // Always-current gameState ref — prevents stale-closure reads inside socket event handlers
  // (gameState is NOT in the socket effect deps, so closures would read stale values otherwise)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Unified player identity: always resolve via color match (ROAST #2)
  const myColor = room?.players?.find((p) => p.socketId === socket?.id)?.color;
  const myPlayerIndex =
    gameState?.players?.findIndex((p) => p.color === myColor) ?? -1;
  const currentPlayer = room?.players[gameState?.currentPlayerIndex];
  const isMyTurn = socket?.id === currentPlayer?.socketId;

  // Auto-rejoin on page refresh (session-based)
  // Reset the guard when disconnected so reconnect triggers a fresh rejoin
  useEffect(() => {
    if (!connected) {
      rejoinAttempted.current = false;
    }
  }, [connected]);

  // Rejoin on initial load (page refresh)
  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }
    if (room && gameState) return;
    if (rejoinAttempted.current) return;

    rejoinAttempted.current = true;
    let cancelled = false;

    const tryRejoin = async () => {
      try {
        const { sessionId, userId, currentRoomCode } = useUserStore.getState();
        if (!sessionId || !userId || !currentRoomCode) {
          navigate("/");
          return;
        }
        // Wait for socket to be fully connected before emitting
        await waitForConnection();
        if (cancelled) return;

        const payload = {
          sessionId,
          userId,
          roomCode: currentRoomCode,
        };
        const response = await emit("find_my_room", payload);
        if (cancelled) return;

        if (response.success) {
          setRoom(response.room);
          if (response.sessionId) {
            setSession({
              sessionId: response.sessionId,
              userId: response.userId,
              username: response.username,
              roomCode: response.roomCode,
            });
          }
          if (response.room?.gameStarted && response.gameState) {
            setGameState(response.gameState);
          } else {
            navigate(`/lobby/${response.roomCode}`);
          }
        } else {
          setCurrentRoomCode(null);
          navigate("/");
        }
      } catch {
        setCurrentRoomCode(null);
        navigate("/");
      }
    };

    tryRejoin();

    return () => {
      cancelled = true;
    };
  }, [
    connected,
    username,
    room,
    gameState,
    emit,
    waitForConnection,
    setRoom,
    setGameState,
    navigate,
  ]);

  // Auto-rejoin after socket reconnection (mid-game disconnect recovery)
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = async () => {
      const { sessionId, userId, currentRoomCode } = useUserStore.getState();
      if (!sessionId || !userId || !currentRoomCode) return;

      try {
        const response = await emit("find_my_room", {
          sessionId,
          userId,
          roomCode: currentRoomCode,
        });
        if (response.success) {
          setRoom(response.room);
          if (response.room?.gameStarted && response.gameState) {
            setGameState(response.gameState);
          }
        }
      } catch {
        // Reconnection failed — user will see the "Reconnecting…" banner
      }
    };

    socket.io.on("reconnect", handleReconnect);
    return () => {
      socket.io.off("reconnect", handleReconnect);
    };
  }, [socket, emit, setRoom, setGameState]);

  useEffect(() => {
    if (!socket || !room?.gameStarted || !gameState) return;

    // Socket event handlers
    const handleDiceRolled = (data) => {
      soundManager.playDiceRoll();
      setIsRolling(true);
      lastDiceValueRef.current = data.value;

      setTimeout(() => {
        setDiceValue(data.value);
        setIsRolling(false);

        // Set available moves for current player
        if (data.playerIndex === myPlayerIndex) {
          const moves = data.movesAvailable.map((m) => ({
            ...m,
            playerIndex: data.playerIndex,
          }));
          setMovesAvailable(moves);
        }
      }, 800);
    };

    const handleTokenMoved = (data) => {
      // Clear timer bar immediately — turn is done
      setTurnExpiresAt(null);
      setDiceValue(null);
      setMovesAvailable([]);

      // Compute path of intermediate positions for step animation
      const {
        playerIndex,
        tokenIndex,
        newPosition,
        capturedToken,
        reachedHome,
      } = data;
      const finalGameState = data.gameState;

      // Find where the token currently is before the move — use ref for fresh state
      const currentTokenState =
        gameStateRef.current?.players?.[playerIndex]?.tokens?.[tokenIndex];
      if (!currentTokenState) {
        // Fallback: apply immediately
        soundManager.playTokenMove();
        setGameState(finalGameState);
        if (capturedToken) soundManager.playCapture();
        if (reachedHome) soundManager.playTokenHome();
        flushPendingEvents();
        return;
      }

      const color = gameStateRef.current.players[playerIndex].color;
      const diceVal = lastDiceValueRef.current || 1;
      const path = computeTokenPath(
        color,
        currentTokenState.position,
        currentTokenState.inBase,
        newPosition,
        diceVal || 1,
      );

      if (path.length <= 1) {
        // Single step or base unlock — just apply with one click
        soundManager.playTokenStep();
        setGameState(finalGameState);
        if (capturedToken) soundManager.playCapture();
        if (reachedHome) soundManager.playTokenHome();
        flushPendingEvents();
        return;
      }

      // Animate each step: mutate a working copy of gameState step by step
      const STEP_DELAY = 250; // ms between each step
      let stepIndex = 0;
      let prevPos = currentTokenState.position;
      animatingRef.current = true;

      const stepInterval = setInterval(() => {
        const pos = path[stepIndex];
        stepIndex++;

        // Compute direction for bounce animation
        const dir = getMoveDirection(
          prevPos,
          pos,
          color,
          TRACK_POSITIONS,
          HOME_COLUMNS,
        );
        setMoveAnimation({ playerIndex, tokenIndex, direction: dir });
        prevPos = pos;

        if (stepIndex < path.length) {
          // Intermediate step — update only this token's position
          setGameState((prev) => {
            if (!prev) return finalGameState;
            const players = prev.players.map((p, pi) => {
              if (pi !== playerIndex) return p;
              return {
                ...p,
                tokens: p.tokens.map((t, ti) => {
                  if (ti !== tokenIndex) return t;
                  return { ...t, position: pos, inBase: false, onBoard: true };
                }),
              };
            });
            return { ...prev, players };
          });

          // Sound per step
          soundManager.playTokenStep();

          // Star landing sound
          if (SAFE_POSITIONS.includes(pos)) {
            soundManager.playStarLand();
          }
        } else {
          // Final step — apply the authoritative server game state
          clearInterval(stepInterval);
          soundManager.playTokenStep();

          if (SAFE_POSITIONS.includes(pos)) {
            soundManager.playStarLand();
          }

          setGameState(finalGameState);

          if (capturedToken) {
            setTimeout(() => soundManager.playCapture(), 80);
          }
          if (reachedHome) {
            setTimeout(() => soundManager.playTokenHome(), 150);
          }

          // Animation done — flush any queued events
          animatingRef.current = false;
          setMoveAnimation(null);
          flushPendingEvents();
        }
      }, STEP_DELAY);
    };

    const flushPendingEvents = () => {
      const queued = pendingEventsRef.current.splice(0);
      queued.forEach((fn) => fn());
    };

    const applyTurnChanged = (data) => {
      setGameState((prev) => ({
        ...prev,
        currentPlayerIndex: data.currentPlayerIndex,
      }));
      setDiceValue(null);
      setMovesAvailable([]);
      setTurnExpiresAt(null);
    };

    const handleTurnChanged = (data) => {
      if (animatingRef.current) {
        // Queue until animation finishes
        pendingEventsRef.current.push(() => applyTurnChanged(data));
      } else {
        applyTurnChanged(data);
      }
    };

    const handleGameEnded = (data) => {
      soundManager.playWin();
      setWinnerStore(data.winnerData);
      if (data.rankings) setRankings(data.rankings);
    };

    const handlePlayerDisconnected = (data) => {
      setRoom(data.room);
    };

    const handlePlayerReconnected = (data) => {
      setRoom(data.room);
    };

    const handleChatMessage = (data) => {
      addChatMessage(data);
    };

    const handleTurnTimer = (data) => {
      setTurnExpiresAt(data.expiresAt);
    };

    const handlePlayersStatus = (data) => {
      setPlayersStatus(data);
    };

    const handleServerError = (data) => {
      setError(data?.message || "Something went wrong");
      setTimeout(() => setError(null), 4000);
    };

    on("dice_rolled", handleDiceRolled);
    on("token_moved", handleTokenMoved);
    on("turn_changed", handleTurnChanged);
    on("game_ended", handleGameEnded);
    on("player_disconnected", handlePlayerDisconnected);
    on("player_reconnected", handlePlayerReconnected);
    on("chat_message", handleChatMessage);
    on("turn_timer", handleTurnTimer);
    on("players_status", handlePlayersStatus);
    on("server_error", handleServerError);

    return () => {
      off("dice_rolled", handleDiceRolled);
      off("token_moved", handleTokenMoved);
      off("turn_changed", handleTurnChanged);
      off("game_ended", handleGameEnded);
      off("player_disconnected", handlePlayerDisconnected);
      off("player_reconnected", handlePlayerReconnected);
      off("chat_message", handleChatMessage);
      off("turn_timer", handleTurnTimer);
      off("players_status", handlePlayersStatus);
      off("server_error", handleServerError);
    };
  }, [
    socket,
    room,
    myPlayerIndex,
    navigate,
    roomCode,
    on,
    off,
    setRoom,
    setGameState,
    setDiceValue,
    setIsRolling,
    setMovesAvailable,
    setTurnExpiresAt,
    setPlayersStatus,
    addChatMessage,
    setWinnerStore,
    setRankings,
  ]);

  const handleRollDice = async () => {
    if (!isMyTurn || isRolling || diceValue) return;

    // Clear the roll-timer bar immediately on click
    setTurnExpiresAt(null);

    try {
      await emit("roll_dice", {});
    } catch (err) {
      console.log("Roll dice error:", err.message);
    }
  };

  const handleTokenClick = async (playerIndex, tokenIndex) => {
    if (!isMyTurn || !diceValue) return;

    const isValidMove =
      movesAvailable.some((m) => m.tokenIndex === tokenIndex) &&
      playerIndex === myPlayerIndex;

    if (!isValidMove) return;

    setSelectedToken({ playerIndex, tokenIndex });
    // Clear timer bar immediately — player has acted
    setTurnExpiresAt(null);

    try {
      await emit("move_token", { tokenIndex });
      setMovesAvailable([]);
      setSelectedToken(null);
    } catch (err) {
      setSelectedToken(null);
      console.error("Move error:", err.message);
    }
  };

  // Auto-move when there is exactly one available move
  const autoMoveTimerRef = useRef(null);
  useEffect(() => {
    if (!isMyTurn || !diceValue || movesAvailable.length !== 1) {
      if (autoMoveTimerRef.current) {
        clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
      return;
    }

    const move = movesAvailable[0];
    autoMoveTimerRef.current = setTimeout(() => {
      handleTokenClick(myPlayerIndex, move.tokenIndex);
    }, 400);

    return () => {
      if (autoMoveTimerRef.current) {
        clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
    };
  }, [isMyTurn, diceValue, movesAvailable, myPlayerIndex]);

  const handleSendMessage = async (message) => {
    try {
      await emit("chat_message", { message });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit("leave_room");
    }
    setCurrentRoomCode(null);
    setRoom(null);
    setGameState(null);
    navigate("/");
  };

  const handlePlayAgain = () => {
    navigate(`/lobby/${roomCode}`);
  };

  // Get player by color
  const getPlayerByColor = (color) => {
    return room?.players.find((p) => p.color === color);
  };

  // Check if a color is the current turn
  const isColorTurn = (color) => {
    const player = getPlayerByColor(color);
    if (!player) return false;
    const playerIndex = room.players.indexOf(player);
    return playerIndex === gameState.currentPlayerIndex;
  };

  // Check if I am the player with this color
  const isMyColor = (color) => {
    const player = getPlayerByColor(color);
    return player?.socketId === socket?.id;
  };

  // Helper to render a PlayerDiceBox for a given color
  const renderPlayerDiceBox = (color) => {
    const player = getPlayerByColor(color);
    if (!player) return null;
    const isTurn = isColorTurn(color);
    const isMe = isMyColor(color);
    const status = playersStatus.find((s) => s.userId === player.userId);
    return (
      <PlayerDiceBox
        player={player}
        isCurrentTurn={isTurn}
        isMe={isMe}
        canRoll={isMe && isTurn && !isRolling && !diceValue}
        diceValue={diceValue}
        isRolling={isRolling}
        onRoll={handleRollDice}
        turnExpiresAt={turnExpiresAt}
        presenceStatus={status?.status}
        isHost={player.socketId === room.hostId}
      />
    );
  };

  if (!room || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card">
          <p className="text-white">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-4 flex flex-col items-center justify-center">
      {/* Exit + Mute buttons - fixed position */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <button
          onClick={() => {
            const next = soundManager.toggle();
            setSoundEnabled(next);
          }}
          className="p-1.5 rounded-lg bg-gray-800/80 text-white hover:bg-gray-700 transition-colors"
          title={soundEnabled ? "Mute" : "Unmute"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <Button
          onClick={handleLeave}
          variant="danger"
          className="text-sm px-3 py-1.5 flex items-center gap-1.5"
        >
          <LogOut size={16} />
          Exit
        </Button>
      </div>

      {/* Connection status banner */}
      {connectionStatus !== "connected" && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-amber-600 text-white px-6 py-2 rounded-lg shadow-lg z-50 text-sm"
        >
          {connectionStatus === "connecting" ? "Reconnecting…" : "Disconnected"}
        </motion.div>
      )}

      {/* Main game area with board and player dice */}
      <div className="relative flex items-center justify-center">
        {/* YELLOW player - top left */}
        <div className="absolute -top-2 -left-2 sm:-top-4 sm:-left-4 transform -translate-y-full -translate-x-1/4 z-20">
          {renderPlayerDiceBox("YELLOW")}
        </div>

        {/* RED player - top right */}
        <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 transform -translate-y-full translate-x-1/4 z-20">
          {renderPlayerDiceBox("RED")}
        </div>

        {/* Game Board */}
        <GameBoard
          gameState={gameState}
          onTokenClick={handleTokenClick}
          selectedToken={selectedToken}
          movesAvailable={movesAvailable}
        />

        {/* BLUE player - bottom left */}
        <div className="absolute -bottom-2 -left-2 sm:-bottom-4 sm:-left-4 transform translate-y-full -translate-x-1/4 z-20">
          {renderPlayerDiceBox("BLUE")}
        </div>

        {/* GREEN player - bottom right */}
        <div className="absolute -bottom-2 -right-2 sm:-bottom-4 sm:-right-4 transform translate-y-full translate-x-1/4 z-20">
          {renderPlayerDiceBox("GREEN")}
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50"
        >
          {error}
        </motion.div>
      )}

      {/* Chat */}
      <Chat messages={chatMessages} onSendMessage={handleSendMessage} />

      {/* Game over modal — winner celebration for 1st place, loser for everyone else */}
      <WinnerModal
        isOpen={showWinner}
        winner={winner}
        rankings={rankings}
        myPlayerIndex={myPlayerIndex}
        onPlayAgain={handlePlayAgain}
        onLeave={handleLeave}
      />
    </div>
  );
};

export default Game;
