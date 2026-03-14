import { GameEngine } from "../gameEngine/GameEngine.js";

/**
 * Handles all Redis persistence for rooms and sessions.
 * Pure I/O layer — no game logic.
 */
export class RedisStore {
  constructor(redis) {
    this.redis = redis;
  }

  async saveRoom(roomCode, room) {
    if (!this.redis) return;
    const serialisable = { ...room, gameEngine: undefined };
    serialisable.gameEngineState = room.gameEngine
      ? {
          gameState: room.gameEngine.getGameState(),
          playerCount: room.gameEngine.playerCount,
          playerColors: room.gameEngine.playerColors,
        }
      : null;
    try {
      await this.redis.set(`room:${roomCode}`, JSON.stringify(serialisable));
    } catch (e) {
      console.error("Redis saveRoom error:", e.message);
    }
  }

  async saveSession(sessionId, meta) {
    if (!this.redis) return;
    try {
      await this.redis.set(`session:${sessionId}`, JSON.stringify(meta));
    } catch (e) {
      console.error("Redis saveSession error:", e.message);
    }
  }

  async deleteSession(sessionId) {
    if (!this.redis) return;
    try {
      await this.redis.del(`session:${sessionId}`);
    } catch (e) {
      /* ignore */
    }
  }

  async loadRoom(roomCode) {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(`room:${roomCode}`);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.gameEngineState) {
        const ge = new GameEngine(
          data.gameEngineState.playerCount,
          data.gameEngineState.playerColors,
        );
        ge.gameState = data.gameEngineState.gameState;
        ge.currentPlayerIndex =
          data.gameEngineState.gameState.currentPlayerIndex;
        data.gameEngine = ge;
      }
      delete data.gameEngineState;
      return data;
    } catch (e) {
      console.error("Redis loadRoom error:", e.message);
      return null;
    }
  }

  async loadSession(sessionId) {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(`session:${sessionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  async deleteRoom(roomCode) {
    if (!this.redis) return;
    try {
      await this.redis.del(`room:${roomCode}`);
    } catch (e) {
      /* ignore */
    }
  }

  async allRoomKeys() {
    if (!this.redis) return [];
    try {
      return await this.redis.keys("room:*");
    } catch (e) {
      console.error("Redis allRoomKeys error:", e.message);
      return [];
    }
  }
}
