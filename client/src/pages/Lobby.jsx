import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Check, UserMinus, LogOut } from "lucide-react";
import Button from "../components/Button";
import { useSocketStore } from "../store/socketStore";
import { useGameStore } from "../store/gameStore";
import { useUserStore } from "../store/userStore";
import PlayerInfo from "../components/PlayerInfo";
import { COLOR_MAP } from "../utils/constants";

const Lobby = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const socket = useSocketStore((state) => state.socket);
  const connected = useSocketStore((state) => state.connected);
  const emit = useSocketStore((state) => state.emit);
  const waitForConnection = useSocketStore((state) => state.waitForConnection);
  const on = useSocketStore((state) => state.on);
  const off = useSocketStore((state) => state.off);
  const room = useGameStore((state) => state.room);
  const setRoom = useGameStore((state) => state.setRoom);
  const username = useUserStore((state) => state.username);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const rejoinAttempted = useRef(false);

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    // Rejoin room via socket if room state is missing (e.g. page refresh)
    // Wait for the socket to be fully connected before emitting.
    if (!room && !rejoinAttempted.current) {
      rejoinAttempted.current = true;
      let cancelled = false;

      const rejoin = async () => {
        try {
          // Block until the socket connect event fires (or is already connected)
          await waitForConnection();
          if (cancelled) return;

          const { sessionId, userId, currentRoomCode } =
            useUserStore.getState();
          const payload = { username };
          if (sessionId && userId && currentRoomCode) {
            payload.sessionId = sessionId;
            payload.userId = userId;
            payload.roomCode = currentRoomCode;
          }
          const response = await emit("find_my_room", payload);
          if (cancelled) return;

          if (response.success) {
            setRoom(response.room);
            // Restore isReady from server state
            const currentSocket = useSocketStore.getState().socket;
            const me = response.room?.players?.find(
              (p) => p.socketId === currentSocket?.id,
            );
            if (me?.ready) setIsReady(true);

            if (response.sessionId) {
              useUserStore.getState().setSession({
                sessionId: response.sessionId,
                userId: response.userId,
                username: response.username,
                roomCode: response.roomCode,
              });
            } else {
              useUserStore.getState().setCurrentRoomCode(response.roomCode);
            }
            if (response.room?.gameStarted && response.gameState) {
              useGameStore.getState().setGameState(response.gameState);
              navigate(`/game/${response.roomCode}`);
              return;
            }
          } else {
            setError("Room not found");
            setTimeout(() => navigate("/"), 2000);
          }
        } catch (err) {
          console.error("Failed to rejoin room:", err);
        }
      };
      rejoin();

      return () => {
        cancelled = true;
      };
    }

    // The rest of this effect only makes sense when connected
    if (!connected) return;

    // Socket event handlers
    const handlePlayerJoined = (data) => {
      setRoom(data.room);
    };

    const handlePlayerLeft = (data) => {
      if (data.roomDeleted) {
        setError("Room has been closed");
        setTimeout(() => navigate("/"), 2000);
      } else {
        setRoom(data.room);
      }
    };

    const handlePlayerReadyUpdate = (data) => {
      setRoom(data.room);
    };

    const handleGameStarted = (data) => {
      setRoom(data.room || room);
      useGameStore.getState().setGameState(data.gameState);
      navigate(`/game/${roomCode}`);
    };

    const handlePlayerKicked = () => {
      setError("You have been kicked from the room");
      useUserStore.getState().setCurrentRoomCode(null);
      setRoom(null);
      setTimeout(() => navigate("/"), 2000);
    };

    on("player_joined", handlePlayerJoined);
    on("player_left", handlePlayerLeft);
    on("player_ready_update", handlePlayerReadyUpdate);
    on("game_started", handleGameStarted);
    on("player_kicked", handlePlayerKicked);

    return () => {
      off("player_joined", handlePlayerJoined);
      off("player_left", handlePlayerLeft);
      off("player_ready_update", handlePlayerReadyUpdate);
      off("game_started", handleGameStarted);
      off("player_kicked", handlePlayerKicked);
    };
  }, [
    socket,
    username,
    connected,
    navigate,
    on,
    off,
    emit,
    waitForConnection,
    setRoom,
    roomCode,
    room,
  ]);

  const handleReady = async () => {
    try {
      await emit("player_ready", { ready: !isReady });
      setIsReady(!isReady);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    try {
      await emit("start_game", {});
    } catch (err) {
      setError(err.message || "Failed to start game");
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit("leave_room");
    }
    useUserStore.getState().setCurrentRoomCode(null);
    setRoom(null);
    navigate("/");
  };

  const handleKickPlayer = async (playerSocketId) => {
    if (!isHost) return;

    try {
      await emit("kick_player", { playerSocketId });
    } catch (err) {
      setError(err.message || "Failed to kick player");
      setTimeout(() => setError(""), 3000);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card">
          <p className="text-white">Loading lobby...</p>
        </div>
      </div>
    );
  }

  const isHost = socket?.id === room.hostId;
  const allReady = room.players.every((p) => p.ready);
  const canStart = allReady && room.players.length >= 2 && isHost;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card max-w-2xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Game Lobby</h1>

          {/* Room code */}
          <div className="inline-flex items-center gap-3 bg-gray-800 px-6 py-3 rounded-lg border border-gray-700">
            <div>
              <p className="text-gray-400 text-sm">Room Code</p>
              <p className="text-3xl font-bold text-white tracking-wider">
                {roomCode}
              </p>
            </div>
            <button
              onClick={copyRoomCode}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="mb-8">
          <h2 className="text-white text-xl font-semibold mb-4">
            Players ({room.players.length}/{room.playerCount})
          </h2>
          <div
            className={`grid gap-3 ${room.playerCount === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}
          >
            {room.players.map((player, index) => (
              <div key={index} className="relative">
                <PlayerInfo
                  player={player}
                  isCurrentUser={socket?.id === player.socketId}
                  isHost={player.socketId === room.hostId}
                />
                {isHost && socket?.id !== player.socketId && (
                  <button
                    onClick={() => handleKickPlayer(player.socketId)}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded transition-colors"
                    title="Kick player"
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: room.playerCount - room.players.length }).map(
              (_, index) => (
                <div
                  key={`empty-${index}`}
                  className="card p-4 border-2 border-dashed border-gray-600"
                >
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                      <UserMinus size={24} className="text-gray-500" />
                    </div>
                    <p className="text-gray-500">Waiting for player...</p>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleReady}
            variant={isReady ? "secondary" : "secondary"}
            className={`flex-1 ${isReady ? "!bg-transparent !border-2 !border-white !text-white hover:!bg-white/10" : "!bg-white !text-gray-900 hover:!bg-gray-200"}`}
          >
            {isReady ? "Not Ready" : "Ready Up"}
          </Button>

          {isHost && (
            <Button
              onClick={handleStartGame}
              variant="primary"
              disabled={!canStart}
              className="flex-1 !bg-emerald-600 hover:!bg-emerald-700"
            >
              Start Game
            </Button>
          )}

          <Button
            onClick={handleLeave}
            variant="danger"
            className="px-6 flex items-center gap-2"
          >
            <LogOut size={18} />
            Exit
          </Button>
        </div>

        {/* Info messages */}
        <div className="mt-4 text-center">
          {!allReady && (
            <p className="text-white/70 text-sm">
              Waiting for all players to be ready...
            </p>
          )}
          {room.players.length < 2 && (
            <p className="text-white/70 text-sm">
              Need at least 2 players to start
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Lobby;
