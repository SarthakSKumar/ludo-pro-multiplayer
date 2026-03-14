import { validateRoomCode } from "../utils/helpers.js";
import {
  TURN_TIMEOUT,
  HEARTBEAT_INTERVAL_MS,
  MAX_CHAT_LENGTH,
} from "../gameEngine/constants.js";
import { createTimerManager } from "./timerManager.js";
import { createGameActions } from "./gameActions.js";

export function setupSocketHandlers(io, roomManager, redisConnection) {
  // ── Timer subsystem ─────────────────────────────────────────────────────
  const timerManager = createTimerManager(io, roomManager, redisConnection);

  // ── Game action helpers ──────────────────────────────────────────────────
  const gameActions = createGameActions(io, roomManager, timerManager);

  // Wire timer dispatch → game actions (avoids circular module dependency)
  timerManager.setDispatch((type, roomCode) => {
    switch (type) {
      case "roll":
        gameActions.executeDiceRoll(roomCode);
        break;
      case "move":
        gameActions.autoMoveToken(roomCode);
        break;
      case "pass":
        gameActions.executePassTurn(roomCode);
        break;
      case "resetDice":
        gameActions.executeResetDice(roomCode);
        break;
    }
  });

  const { clearRoomTimers, clearRollTimer, clearMoveTimer, startRollTimer } =
    timerManager;

  const {
    handlePostDiceRoll,
    handleMoveOutcome,
    advanceTurnSkippingDisconnected,
  } = gameActions;

  // ── Grace-period player removal → notify remaining players ───────────────
  roomManager.onPlayerGracePeriodExpired = (roomCode, result) => {
    if (!result?.success) return;
    if (result.roomDeleted) {
      clearRoomTimers(roomCode);
      io.to(roomCode).emit("player_left", { roomDeleted: true });
    } else {
      io.to(roomCode).emit("player_left", {
        room: result.room,
        roomDeleted: false,
      });
    }
  };

  // ── Player presence heartbeat ────────────────────────────────────────────
  setInterval(() => {
    for (const [roomCode, room] of roomManager.rooms) {
      if (!room.players || room.players.length === 0) continue;
      const statuses = room.players.map((p) => {
        const sock = io.sockets.sockets.get(p.socketId);
        let status = "disconnected";
        if (sock && sock.connected) {
          status = p.connected ? "active" : "away";
        }
        return { userId: p.userId, status };
      });
      io.to(roomCode).emit("players_status", statuses);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // ── Socket event handlers ────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Simple per-socket rate limiter
    const rateBuckets = {};
    function rateLimit(event, maxPerWindow = 10, windowMs = 5000) {
      const now = Date.now();
      const bucket = rateBuckets[event] || { count: 0, reset: now + windowMs };
      if (now > bucket.reset) {
        bucket.count = 0;
        bucket.reset = now + windowMs;
      }
      bucket.count++;
      rateBuckets[event] = bucket;
      return bucket.count > maxPerWindow;
    }

    // Create room
    socket.on("create_room", (data, callback) => {
      try {
        if (rateLimit("create_room", 3, 10000))
          return callback({ success: false, error: "Too many requests" });
        const { playerCount = 4 } = data;
        const user = socket.user; // from JWT middleware

        const result = roomManager.createRoom(socket.id, user, playerCount);
        if (result.success) socket.join(result.roomCode);
        callback(result);
      } catch (error) {
        console.error("Error creating room:", error);
        callback({ success: false, error: "Failed to create room" });
        socket.emit("server_error", { message: "Failed to create room" });
      }
    });

    // Join room
    socket.on("join_room", (data, callback) => {
      try {
        if (rateLimit("join_room", 5, 5000))
          return callback({ success: false, error: "Too many requests" });
        const { roomCode } = data;

        if (!validateRoomCode(roomCode))
          return callback({ success: false, error: "Invalid room code" });

        const user = socket.user; // from JWT middleware

        const result = roomManager.joinRoom(
          roomCode.toUpperCase(),
          socket.id,
          user,
          false,
        );

        if (result.success) {
          socket.join(roomCode.toUpperCase());
          socket
            .to(roomCode.toUpperCase())
            .emit("player_joined", { room: result.room });
        }
        callback(result);
      } catch (error) {
        console.error("Error joining room:", error);
        callback({ success: false, error: "Failed to join room" });
        socket.emit("server_error", { message: "Failed to join room" });
      }
    });

    // Session-based rejoin
    socket.on("rejoin_room", (data, callback) => {
      try {
        if (rateLimit("rejoin_room", 5, 5000))
          return callback({ success: false, error: "Too many requests" });
        const { roomCode } = data;
        const userId = socket.user.id;

        if (!roomCode)
          return callback({
            success: false,
            error: "Missing room code",
          });
        if (!validateRoomCode(roomCode))
          return callback({ success: false, error: "Invalid room code" });

        const result = roomManager.rejoinByUserId(
          userId,
          roomCode.toUpperCase(),
          socket.id,
        );

        if (result.success) {
          socket.join(roomCode.toUpperCase());
          socket
            .to(roomCode.toUpperCase())
            .emit("player_reconnected", { room: result.room });
        }
        callback(result);
      } catch (error) {
        console.error("Error rejoining room:", error);
        callback({ success: false, error: "Failed to rejoin room" });
        socket.emit("server_error", { message: "Failed to rejoin room" });
      }
    });

    // Player ready
    socket.on("player_ready", (data, callback) => {
      try {
        if (rateLimit("player_ready", 5, 3000))
          return callback({ success: false, error: "Too many requests" });
        const { ready } = data;
        const result = roomManager.playerReady(socket.id, ready);

        if (result.success) {
          const roomCode = Array.from(socket.rooms).find(
            (r) => r !== socket.id,
          );
          io.to(roomCode).emit("player_ready_update", { room: result.room });
          callback({ success: true });
        } else {
          callback(result);
        }
      } catch (error) {
        console.error("Error updating ready status:", error);
        callback({ success: false, error: "Failed to update ready status" });
      }
    });

    // Start game
    socket.on("start_game", (data, callback) => {
      try {
        if (rateLimit("start_game", 2, 5000))
          return callback({ success: false, error: "Too many requests" });
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return callback({ success: false, error: "Room not found" });
        if (socket.id !== room.hostId)
          return callback({
            success: false,
            error: "Only host can start the game",
          });

        const result = roomManager.startGame(room.code);
        if (result.success) {
          io.to(room.code).emit("game_started", {
            gameState: result.gameState,
            room: result.room,
          });
          callback({ success: true, gameState: result.gameState });
          startRollTimer(room.code);
        } else {
          callback(result);
        }
      } catch (error) {
        console.error("Error starting game:", error);
        callback({ success: false, error: "Failed to start game" });
        socket.emit("server_error", { message: "Failed to start game" });
      }
    });

    // Kick player
    socket.on("kick_player", (data, callback) => {
      try {
        if (rateLimit("kick_player", 3, 5000))
          return callback({ success: false, error: "Too many requests" });
        const { playerSocketId } = data;
        const result = roomManager.kickPlayer(socket.id, playerSocketId);

        if (result.success) {
          io.to(playerSocketId).emit("player_kicked");
          io.to(result.roomCode).emit("player_left", { room: result.room });
          const kickedSocket = io.sockets.sockets.get(playerSocketId);
          if (kickedSocket) kickedSocket.leave(result.roomCode);
          callback({ success: true });
        } else {
          callback(result);
        }
      } catch (error) {
        console.error("Error kicking player:", error);
        callback({ success: false, error: "Failed to kick player" });
      }
    });

    // Roll dice
    socket.on("roll_dice", (data, callback) => {
      try {
        if (rateLimit("roll_dice", 5, 3000))
          return callback({ success: false, error: "Too many requests" });
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || !room.gameStarted)
          return callback({ success: false, error: "Game not started" });

        const fullRoom = roomManager.rooms.get(room.code);
        const gameEngine = fullRoom.gameEngine;
        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player)
          return callback({ success: false, error: "Player not found" });
        if (!gameEngine.canRollDice(player.playerIndex))
          return callback({
            success: false,
            error: "Not your turn or already rolled",
          });

        clearRollTimer(room.code);

        const result = gameEngine.rollDice();
        roomManager._saveRoom(room.code);

        io.to(room.code).emit("dice_rolled", {
          playerIndex: player.playerIndex,
          value: result.value,
          movesAvailable: result.movesAvailable,
          hasExtraTurn: result.hasExtraTurn,
        });

        handlePostDiceRoll(room.code, result);
        callback({ success: true, result });
      } catch (error) {
        console.error("Error rolling dice:", error);
        callback({ success: false, error: "Failed to roll dice" });
        socket.emit("server_error", { message: "Failed to roll dice" });
      }
    });

    // Move token
    socket.on("move_token", (data, callback) => {
      try {
        if (rateLimit("move_token", 5, 3000))
          return callback({ success: false, error: "Too many requests" });
        const { tokenIndex } = data;
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || !room.gameStarted)
          return callback({ success: false, error: "Game not started" });

        const fullRoom = roomManager.rooms.get(room.code);
        const gameEngine = fullRoom.gameEngine;
        const player = room.players.find((p) => p.socketId === socket.id);
        if (!player)
          return callback({ success: false, error: "Player not found" });
        if (gameEngine.gameState.diceValue === null)
          return callback({ success: false, error: "Roll dice first" });

        const result = gameEngine.moveToken(
          player.playerIndex,
          tokenIndex,
          gameEngine.gameState.diceValue,
        );

        if (result.success) {
          clearMoveTimer(room.code);
          roomManager._saveRoom(room.code);

          io.to(room.code).emit("token_moved", {
            playerIndex: player.playerIndex,
            tokenIndex,
            newPosition: result.newPosition,
            capturedToken: result.capturedToken,
            hasExtraTurn: result.hasExtraTurn,
            reachedHome: result.reachedHome,
            rankings: gameEngine.rankings,
            gameState: gameEngine.getGameState(),
          });

          handleMoveOutcome(room.code, result, player.playerIndex, tokenIndex);
          callback({ success: true, result });
        } else {
          callback(result);
        }
      } catch (error) {
        console.error("Error moving token:", error);
        callback({ success: false, error: "Failed to move token" });
        socket.emit("server_error", { message: "Failed to move token" });
      }
    });

    // Leave room
    socket.on("leave_room", () => {
      try {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;
        const roomCode = room.code;
        const result = roomManager.leaveRoom(socket.id);
        socket.leave(roomCode);

        if (result.success) {
          if (result.roomDeleted) {
            clearRoomTimers(roomCode);
            io.to(roomCode).emit("player_left", { roomDeleted: true });
          } else {
            io.to(roomCode).emit("player_left", {
              room: result.room,
              roomDeleted: false,
            });
          }
        }
      } catch (error) {
        console.error("Error leaving room:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      try {
        const room = roomManager.getRoomBySocketId(socket.id);
        const result = roomManager.handleDisconnect(socket.id);
        if (result) {
          io.to(result.roomCode).emit("player_disconnected", {
            room: result.room,
          });

          // If the disconnected player was the current turn holder, advance the turn
          const fullRoom = roomManager.rooms.get(result.roomCode);
          if (
            fullRoom?.gameStarted &&
            !fullRoom.gameEnded &&
            fullRoom.gameEngine
          ) {
            const currentPlayer =
              fullRoom.players[fullRoom.gameEngine.currentPlayerIndex];
            if (currentPlayer && currentPlayer.socketId === socket.id) {
              advanceTurnSkippingDisconnected(result.roomCode);
              io.to(result.roomCode).emit("turn_changed", {
                currentPlayerIndex: fullRoom.gameEngine.currentPlayerIndex,
              });
              startRollTimer(result.roomCode);
            }
          }
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    });

    // Reconnect (legacy — kept for backward compatibility)
    socket.on("reconnect_room", (data, callback) => {
      try {
        const { roomCode } = data;
        const userId = socket.user.id;
        if (userId && roomCode) {
          const result = roomManager.rejoinByUserId(
            userId,
            roomCode,
            socket.id,
          );
          if (result.success) {
            socket.join(result.roomCode);
            io.to(result.roomCode).emit("player_reconnected", {
              room: result.room,
            });
            return callback(result);
          }
        }
        callback({ success: false, error: "Failed to reconnect" });
      } catch (error) {
        console.error("Error reconnecting:", error);
        callback({ success: false, error: "Failed to reconnect" });
      }
    });

    // Chat message
    socket.on("chat_message", (data) => {
      try {
        if (rateLimit("chat_message", 5, 5000)) return;
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;
        const player = room.players.find((p) => p.socketId === socket.id);
        let message = typeof data.message === "string" ? data.message : "";
        if (message.length > MAX_CHAT_LENGTH)
          message = message.slice(0, MAX_CHAT_LENGTH);
        if (!message.trim()) return;
        io.to(room.code).emit("chat_message", {
          username: player.username,
          avatar: player.avatar,
          message,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Error sending chat message:", error);
      }
    });

    // Find room by session (page refresh / rejoin)
    socket.on("find_my_room", (data, callback) => {
      try {
        const { roomCode } = data;
        const userId = socket.user.id;
        if (!roomCode)
          return callback({
            success: false,
            error: "Room code required",
          });

        const result = roomManager.rejoinByUserId(
          userId,
          roomCode.toUpperCase(),
          socket.id,
        );

        if (result.success) {
          socket.join(result.roomCode);
          callback(result);
          socket
            .to(result.roomCode)
            .emit("player_reconnected", { room: result.room });

          // Restart turn timer if game is in progress so the board isn't frozen
          const fullRoom = roomManager.rooms.get(result.roomCode);
          if (
            fullRoom?.gameStarted &&
            !fullRoom.gameEnded &&
            fullRoom.gameEngine
          ) {
            const ge = fullRoom.gameEngine;

            // Emit current turn to the reconnecting client so their UI is in sync
            socket.emit("turn_changed", {
              currentPlayerIndex: ge.currentPlayerIndex,
            });

            if (ge.gameState.diceValue === null) {
              startRollTimer(result.roomCode);
            } else if (ge.gameState.movesAvailable.length > 0) {
              timerManager.startMoveTimer(result.roomCode, TURN_TIMEOUT * 1000);
            }
          }
        } else {
          callback(result);
        }
      } catch (error) {
        console.error("Error finding room:", error);
        callback({ success: false, error: "Failed to find room" });
        socket.emit("server_error", { message: "Failed to find room" });
      }
    });
  });
}
