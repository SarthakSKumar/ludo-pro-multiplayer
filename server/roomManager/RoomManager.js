import { GameEngine } from "../gameEngine/GameEngine.js";
import { generateRoomCode } from "../utils/helpers.js";
import {
  RECONNECT_GRACE_PERIOD,
  COLOR_ORDER_4,
  COLOR_ORDER_2_OPTIONS,
  MIN_PLAYERS_TO_START,
} from "../gameEngine/constants.js";
import { randomUUID } from "crypto";
import { RedisStore } from "./RedisStore.js";
import { SessionTracker } from "./SessionTracker.js";
import { PgStore } from "../db/PgStore.js";

export class RoomManager {
  constructor(redis = null) {
    this.store = new RedisStore(redis);
    this.pgStore = null;
    this.sessions = new SessionTracker();
    /** roomCode -> room object (authoritative in-memory state) */
    this._rooms = new Map();
    /** socketId -> roomCode */
    this._playerRooms = new Map();
  }

  /** Attach the Postgres pool after async init (called from server.js). */
  setPgPool(pool) {
    this.pgStore = pool ? new PgStore(pool) : null;
  }

  // ── Convenience aliases (used by socket handlers) ─────────────────────────
  get rooms() {
    return this._rooms;
  }
  get playerRooms() {
    return this._playerRooms;
  }

  // ── Persistence delegates ─────────────────────────────────────────────────
  _saveRoom(roomCode) {
    const room = this._rooms.get(roomCode);
    if (!room) return;
    this.store.saveRoom(roomCode, room);
    // Fire-and-forget PG writes (errors logged inside PgStore)
    if (this.pgStore) {
      this.pgStore.saveRoom(room);
      this.pgStore.savePlayers(roomCode, room.players);
      if (room.gameEngine)
        this.pgStore.saveGameState(roomCode, room.gameEngine);
    }
  }

  // ── Restore rooms from Redis on server boot ───────────────────────────────
  async restoreFromRedis() {
    const keys = await this.store.allRoomKeys();
    for (const key of keys) {
      const roomCode = key.replace("room:", "");
      const room = await this.store.loadRoom(roomCode);
      if (!room) continue;
      this._rooms.set(roomCode, room);
      for (const player of room.players) {
        this._playerRooms.set(player.socketId, roomCode);
        if (player.sessionId) {
          this.sessions.register(player.sessionId, player.socketId, roomCode);
        }
      }
    }
    if (keys.length > 0) {
      console.log(`Restored ${keys.length} room(s) from Redis`);
    }
  }

  // ── Restore rooms from PostgreSQL (source of truth) ─────────────────────
  async restoreFromPg() {
    if (!this.pgStore) return;
    const entries = await this.pgStore.loadAllRooms();
    for (const entry of entries) {
      const { room: r, players, gameState } = entry;

      // Find the host among the players
      const hostPlayer = players.find((p) => !p.left) || players[0];

      const room = {
        code: r.code,
        hostId: hostPlayer?.socketId ?? null,
        playerCount: r.playerCount,
        colorOrder: r.colorOrder,
        players: players.map((p) => ({
          socketId: p.socketId,
          sessionId: p.sessionId,
          userId: p.userId,
          username: p.username,
          avatar: p.avatar,
          color: p.color,
          playerIndex: p.playerIndex,
          ready: p.ready,
          connected: false, // all sockets stale after restart
          left: p.left,
        })),
        gameEngine: null,
        gameStarted: r.gameStarted,
        gameEnded: r.gameEnded,
        createdAt: r.createdAt,
        spectators: [],
      };

      // Rebuild GameEngine from persisted state
      if (gameState) {
        const ge = new GameEngine(
          gameState.playerCount,
          gameState.playerColors,
        );
        ge.gameState = gameState.engineState;
        ge.currentPlayerIndex = gameState.engineState.currentPlayerIndex;
        ge.rankings = gameState.rankings ?? [];
        room.gameEngine = ge;
      }

      this._rooms.set(r.code, room);
      for (const p of room.players) {
        if (p.socketId) this._playerRooms.set(p.socketId, r.code);
        if (p.sessionId) {
          this.sessions.register(p.sessionId, p.socketId, r.code);
        }
      }
    }
    if (entries.length > 0) {
      console.log(`Restored ${entries.length} room(s) from PostgreSQL`);
    }
  }

  // ── Room lifecycle ────────────────────────────────────────────────────────

  createRoom(hostSocketId, hostData, playerCount = 4) {
    let roomCode = generateRoomCode();
    while (this._rooms.has(roomCode)) roomCode = generateRoomCode();

    const sessionId = randomUUID();
    const userId = randomUUID();

    const colorOrder =
      playerCount === 2
        ? COLOR_ORDER_2_OPTIONS[Math.random() < 0.5 ? 0 : 1]
        : COLOR_ORDER_4;

    const room = {
      code: roomCode,
      hostId: hostSocketId,
      playerCount,
      colorOrder,
      players: [
        {
          socketId: hostSocketId,
          sessionId,
          userId,
          username: hostData.username,
          avatar: hostData.avatar,
          color: colorOrder[0],
          playerIndex: 0,
          ready: false,
          connected: true,
        },
      ],
      gameEngine: null,
      gameStarted: false,
      gameEnded: false,
      createdAt: Date.now(),
      spectators: [],
    };

    this._rooms.set(roomCode, room);
    this._playerRooms.set(hostSocketId, roomCode);
    this.sessions.register(sessionId, hostSocketId, roomCode);

    this._saveRoom(roomCode);
    this.store.saveSession(sessionId, {
      userId,
      username: hostData.username,
      roomCode,
      playerIndex: 0,
    });

    return {
      success: true,
      roomCode,
      room: this.sanitizeRoom(room),
      sessionId,
      userId,
      username: hostData.username,
    };
  }

  joinRoom(roomCode, socketId, userData, isRejoin = false) {
    const room = this._rooms.get(roomCode);
    if (!room) return { success: false, error: "Room not found" };

    if (room.players.find((p) => p.socketId === socketId)) {
      return { success: false, error: "Already in room" };
    }
    if (room.gameStarted) {
      return { success: false, error: "Game already started" };
    }
    if (room.players.length >= room.playerCount) {
      return { success: false, error: "Room is full" };
    }

    const sessionId = randomUUID();
    const userId = randomUUID();

    const player = {
      socketId,
      sessionId,
      userId,
      username: userData.username,
      avatar: userData.avatar,
      color: room.colorOrder[room.players.length],
      playerIndex: room.players.length,
      ready: false,
      connected: true,
    };

    room.players.push(player);
    this._playerRooms.set(socketId, roomCode);
    this.sessions.register(sessionId, socketId, roomCode);

    this._saveRoom(roomCode);
    this.store.saveSession(sessionId, {
      userId,
      username: userData.username,
      roomCode,
      playerIndex: player.playerIndex,
    });

    return {
      success: true,
      room: this.sanitizeRoom(room),
      sessionId,
      userId,
      username: userData.username,
    };
  }

  rejoinBySession(sessionId, userId, roomCode, newSocketId) {
    const room = this._rooms.get(roomCode);
    if (!room) return { success: false, error: "Room not found" };

    const player = room.players.find(
      (p) => p.sessionId === sessionId && p.userId === userId,
    );
    if (!player) return { success: false, error: "Invalid session" };

    const oldSocketId = player.socketId;
    player.socketId = newSocketId;
    player.connected = true;

    this._playerRooms.delete(oldSocketId);
    this._playerRooms.set(newSocketId, roomCode);
    this.sessions.updateSocket(sessionId, oldSocketId, newSocketId);

    this._saveRoom(roomCode);

    return {
      success: true,
      roomCode,
      room: this.sanitizeRoom(room),
      gameState: room.gameEngine ? room.gameEngine.getGameState() : null,
      reconnected: true,
      sessionId,
      userId,
      username: player.username,
    };
  }

  leaveRoom(socketId) {
    const roomCode = this._playerRooms.get(socketId);
    if (!roomCode) return { success: false };

    const room = this._rooms.get(roomCode);
    if (!room) return { success: false };

    const playerIndex = room.players.findIndex((p) => p.socketId === socketId);
    if (playerIndex === -1) return { success: false };

    const leavingPlayer = room.players[playerIndex];

    this.sessions.remove(leavingPlayer.sessionId, socketId);
    this._playerRooms.delete(socketId);
    if (leavingPlayer.sessionId) {
      this.store.deleteSession(leavingPlayer.sessionId);
    }

    // During an active game keep the slot (marked left) so indices stay stable
    if (room.gameStarted && !room.gameEnded) {
      leavingPlayer.connected = false;
      leavingPlayer.left = true;
    } else {
      room.players.splice(playerIndex, 1);
    }

    if (room.players.length === 0 || room.players.every((p) => p.left)) {
      this._rooms.delete(roomCode);
      this.store.deleteRoom(roomCode);
      if (this.pgStore) this.pgStore.deleteRoom(roomCode);
      return { success: true, roomDeleted: true, roomCode };
    }

    if (socketId === room.hostId) {
      const nextHost = room.players.find((p) => !p.left);
      if (nextHost) {
        room.hostId = nextHost.socketId;
        console.log(`New host for room ${roomCode}: ${room.hostId}`);
      }
    }

    this._saveRoom(roomCode);
    return { success: true, roomCode, room: this.sanitizeRoom(room) };
  }

  playerReady(socketId, ready) {
    const roomCode = this._playerRooms.get(socketId);
    if (!roomCode) return { success: false, error: "Not in a room" };

    const room = this._rooms.get(roomCode);
    if (!room) return { success: false, error: "Room not found" };

    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return { success: false, error: "Player not found" };

    player.ready = ready;
    this._saveRoom(roomCode);
    return { success: true, room: this.sanitizeRoom(room) };
  }

  canStartGame(roomCode) {
    const room = this._rooms.get(roomCode);
    if (!room) return false;
    if (room.players.length < MIN_PLAYERS_TO_START) return false;
    return room.players.every((p) => p.ready);
  }

  startGame(roomCode) {
    const room = this._rooms.get(roomCode);
    if (!room) return { success: false, error: "Room not found" };

    if (!this.canStartGame(roomCode)) {
      return { success: false, error: "Not all players are ready" };
    }

    const playerColors = room.players.map((p) => p.color);
    room.gameEngine = new GameEngine(room.players.length, playerColors);
    room.gameStarted = true;
    room.gameEngine.gameState.gameStarted = true;

    this._saveRoom(roomCode);

    return {
      success: true,
      room: this.sanitizeRoom(room),
      gameState: room.gameEngine.getGameState(),
    };
  }

  handleDisconnect(socketId) {
    const roomCode = this._playerRooms.get(socketId);
    if (!roomCode) return null;

    const room = this._rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return null;

    player.connected = false;
    this._saveRoom(roomCode);

    const sessionId = player.sessionId;
    this.sessions.markDisconnected(sessionId, {
      roomCode,
      timestamp: Date.now(),
      playerIndex: player.playerIndex,
      socketId,
    });

    setTimeout(
      () => this._checkDisconnectedPlayer(sessionId),
      RECONNECT_GRACE_PERIOD * 1000,
    );

    return { roomCode, room: this.sanitizeRoom(room) };
  }

  _checkDisconnectedPlayer(sessionId) {
    const info = this.sessions.getDisconnected(sessionId);
    if (!info) return;

    const elapsed = Date.now() - info.timestamp;
    if (elapsed >= RECONNECT_GRACE_PERIOD * 1000) {
      const room = this._rooms.get(info.roomCode);
      const player = room?.players.find((p) => p.sessionId === sessionId);
      if (player) this.leaveRoom(player.socketId);
      this.sessions.clearDisconnected(sessionId);
    }
  }

  kickPlayer(hostSocketId, playerSocketId) {
    const roomCode = this._playerRooms.get(hostSocketId);
    if (!roomCode) return { success: false, error: "Not in a room" };

    const room = this._rooms.get(roomCode);
    if (!room) return { success: false, error: "Room not found" };

    if (hostSocketId !== room.hostId) {
      return { success: false, error: "Only host can kick players" };
    }

    const playerIndex = room.players.findIndex(
      (p) => p.socketId === playerSocketId,
    );
    if (playerIndex === -1)
      return { success: false, error: "Player not found" };

    const kickedPlayer = room.players[playerIndex];
    this.sessions.remove(kickedPlayer.sessionId, playerSocketId);
    if (kickedPlayer.sessionId) {
      this.store.deleteSession(kickedPlayer.sessionId);
    }
    if (this.pgStore) this.pgStore.removePlayer(kickedPlayer.userId);
    room.players.splice(playerIndex, 1);
    this._playerRooms.delete(playerSocketId);

    this._saveRoom(roomCode);

    return {
      success: true,
      roomCode,
      kickedSocketId: playerSocketId,
      room: this.sanitizeRoom(room),
    };
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  getRoom(roomCode) {
    const room = this._rooms.get(roomCode);
    return room ? this.sanitizeRoom(room) : null;
  }

  getRoomBySocketId(socketId) {
    const roomCode = this._playerRooms.get(socketId);
    return roomCode ? this.getRoom(roomCode) : null;
  }

  sanitizeRoom(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      playerCount: room.playerCount,
      players: room.players,
      gameStarted: room.gameStarted,
      gameEnded: room.gameEnded,
      createdAt: room.createdAt,
      currentTurn: room.gameEngine?.currentPlayerIndex,
      spectators: room.spectators,
    };
  }

  getRoomStats() {
    return {
      totalRooms: this._rooms.size,
      activePlayers: this._playerRooms.size,
      disconnectedPlayers: this.sessions.disconnectedCount,
    };
  }
}
