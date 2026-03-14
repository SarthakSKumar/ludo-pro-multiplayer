import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, LogIn, Users, Gamepad2, Dice1 } from "lucide-react";
import Button from "../components/Button";
import Input from "../components/Input";
import Modal from "../components/Modal";
import { useSocketStore } from "../store/socketStore";
import { useUserStore } from "../store/userStore";
import { useGameStore } from "../store/gameStore";
import { AVATARS } from "../utils/constants";

const Home = () => {
  const navigate = useNavigate();
  const emit = useSocketStore((state) => state.emit);
  const connected = useSocketStore((state) => state.connected);
  const waitForConnection = useSocketStore((state) => state.waitForConnection);
  const setRoom = useGameStore((state) => state.setRoom);
  const storedUsername = useUserStore((state) => state.username);
  const storedAvatar = useUserStore((state) => state.avatar);
  const currentRoomCode = useUserStore((state) => state.currentRoomCode);
  const [username, setUsername] = useState(storedUsername);
  const [selectedAvatar, setSelectedAvatar] = useState(storedAvatar);
  const [roomCode, setRoomCode] = useState("");
  const [playerCount, setPlayerCount] = useState(4);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const setUserUsername = useUserStore((state) => state.setUsername);
  const setUserAvatar = useUserStore((state) => state.setAvatar);
  const setUserCurrentRoomCode = useUserStore(
    (state) => state.setCurrentRoomCode,
  );
  const setUserSession = useUserStore((state) => state.setSession);

  const storedSessionId = useUserStore((state) => state.sessionId);
  const storedUserId = useUserStore((state) => state.userId);

  // Handle reconnection to previous room (prefer session-based)
  const rejoinAttempted = useRef(false);
  useEffect(() => {
    if (rejoinAttempted.current) return;
    if (!storedSessionId || !storedUserId || !currentRoomCode) return;

    rejoinAttempted.current = true;
    let cancelled = false;

    const tryRejoin = async () => {
      try {
        // Wait until the socket is fully connected before emitting
        await waitForConnection();
        if (cancelled) return;

        const payload = {
          sessionId: storedSessionId,
          userId: storedUserId,
          roomCode: currentRoomCode,
        };

        const response = await emit("find_my_room", payload);
        if (cancelled) return;

        if (response.success) {
          setRoom(response.room);
          if (response.sessionId) {
            setUserSession({
              sessionId: response.sessionId,
              userId: response.userId,
              username: response.username,
              roomCode: response.roomCode,
            });
          } else {
            setUserCurrentRoomCode(response.roomCode);
          }
          if (response.room?.gameStarted && response.gameState) {
            useGameStore.getState().setGameState(response.gameState);
            navigate(`/game/${response.roomCode}`);
          } else {
            navigate(`/lobby/${response.roomCode}`);
          }
        } else {
          setUserCurrentRoomCode(null);
        }
      } catch (err) {
        setUserCurrentRoomCode(null);
      }
    };

    tryRejoin();

    return () => {
      cancelled = true;
    };
  }, [connected, waitForConnection]);

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const avatar =
        selectedAvatar || AVATARS[Math.floor(Math.random() * AVATARS.length)];

      const response = await emit("create_room", {
        username: username.trim(),
        avatar,
        playerCount,
      });

      setUserUsername(username.trim());
      setUserAvatar(avatar);
      // Persist session credentials
      if (response.sessionId) {
        setUserSession({
          sessionId: response.sessionId,
          userId: response.userId,
          username: response.username,
          roomCode: response.roomCode,
        });
      } else {
        setUserCurrentRoomCode(response.roomCode);
      }
      setRoom(response.room);

      navigate(`/lobby/${response.roomCode}`);
    } catch (err) {
      setError(err.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    if (roomCode.trim().length !== 6) {
      setError("Room code must be 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const avatar =
        selectedAvatar || AVATARS[Math.floor(Math.random() * AVATARS.length)];

      const response = await emit("join_room", {
        roomCode: roomCode.trim().toUpperCase(),
        username: username.trim(),
        avatar,
      });

      setUserUsername(username.trim());
      setUserAvatar(avatar);
      // Persist session credentials
      if (response.sessionId) {
        setUserSession({
          sessionId: response.sessionId,
          userId: response.userId,
          username: response.username,
          roomCode: roomCode.trim().toUpperCase(),
        });
      } else {
        setUserCurrentRoomCode(roomCode.trim().toUpperCase());
      }
      setRoom(response.room);

      if (response.room?.gameStarted && response.gameState) {
        useGameStore.getState().setGameState(response.gameState);
        navigate(`/game/${roomCode.trim().toUpperCase()}`);
      } else {
        navigate(`/lobby/${roomCode.trim().toUpperCase()}`);
      }
    } catch (err) {
      setError(err.message || "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card max-w-md w-full text-center"
      >
        {/* Logo/Title */}
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-4 flex justify-center"
        >
          <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700">
            <Dice1 size={64} className="text-emerald-400" />
          </div>
        </motion.div>
        <h1 className="text-5xl font-bold text-white mb-2 flex items-center justify-center gap-3">
          <Gamepad2 className="text-emerald-400" />
          Ludo
        </h1>
        <p className="text-gray-400 mb-8">Play with friends online</p>

        {/* Connection status */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <span className="text-gray-400 text-sm">
            {connected ? "Connected" : "Connecting..."}
          </span>
        </div>

        {/* Username input */}
        <div className="mb-6">
          <Input
            label="Your Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
          />
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            disabled={!connected || username.trim().length < 3}
            className="w-full flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Create Room
          </Button>
          <Button
            onClick={() => setShowJoinModal(true)}
            variant="secondary"
            disabled={!connected || username.trim().length < 3}
            className="w-full flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            Join Room
          </Button>
        </div>

        {/* Footer */}
        <p className="text-gray-500 text-sm mt-8">
          Real-time multiplayer Ludo game
        </p>
      </motion.div>

      {/* Create Room Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setError("");
        }}
        title="Create Room"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Number of Players
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPlayerCount(2)}
                className={`py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  playerCount === 2
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                <Users size={18} />2 Players
              </button>
              <button
                onClick={() => setPlayerCount(4)}
                className={`py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  playerCount === 4
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                <Users size={18} />4 Players
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Choose Avatar (Optional)
            </label>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`text-2xl p-1 rounded-lg transition-all ${
                    selectedAvatar === avatar
                      ? "bg-emerald-600 scale-110"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleCreateRoom}
            variant="success"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            {loading ? "Creating..." : "Create Room"}
          </Button>
        </div>
      </Modal>

      {/* Join Room Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setError("");
          setRoomCode("");
        }}
        title="Join Room"
      >
        <div className="space-y-4">
          <Input
            label="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-digit code"
            maxLength={6}
          />

          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Choose Avatar (Optional)
            </label>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`text-2xl p-1 rounded-lg transition-all ${
                    selectedAvatar === avatar
                      ? "bg-emerald-600 scale-110"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleJoinRoom}
            variant="success"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            {loading ? "Joining..." : "Join Room"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Home;
