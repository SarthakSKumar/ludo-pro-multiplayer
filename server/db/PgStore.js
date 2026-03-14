/**
 * PostgreSQL persistence layer for rooms, players, and game state.
 * Every method is fire-safe: errors are logged but never thrown,
 * so the real-time in-memory path is never blocked by a PG outage.
 */
export class PgStore {
  constructor(pool) {
    this.pool = pool;
  }

  // ── Room operations ─────────────────────────────────────────────────────

  async saveRoom(room) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO rooms (code, host_user_id, player_count, color_order, game_started, game_ended, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
         ON CONFLICT (code) DO UPDATE SET
           host_user_id  = EXCLUDED.host_user_id,
           game_started  = EXCLUDED.game_started,
           game_ended    = EXCLUDED.game_ended`,
        [
          room.code,
          room.players[0]?.userId ?? "00000000-0000-0000-0000-000000000000",
          room.playerCount,
          room.colorOrder,
          room.gameStarted,
          room.gameEnded,
          room.createdAt,
        ],
      );
    } catch (e) {
      console.error("PgStore.saveRoom error:", e.message);
    }
  }

  async savePlayers(roomCode, players) {
    if (!this.pool) return;
    try {
      // Upsert each player; small N (max 4) so individual queries are fine
      for (const p of players) {
        await this.pool.query(
          `INSERT INTO players (user_id, session_id, room_code, socket_id, username, avatar, color, player_index, ready, connected, left_game)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (user_id) DO UPDATE SET
             socket_id    = EXCLUDED.socket_id,
             ready        = EXCLUDED.ready,
             connected    = EXCLUDED.connected,
             left_game    = EXCLUDED.left_game`,
          [
            p.userId,
            p.sessionId,
            roomCode,
            p.socketId,
            p.username,
            p.avatar,
            p.color,
            p.playerIndex,
            p.ready,
            p.connected,
            p.left ?? false,
          ],
        );
      }
    } catch (e) {
      console.error("PgStore.savePlayers error:", e.message);
    }
  }

  async saveGameState(roomCode, gameEngine) {
    if (!this.pool || !gameEngine) return;
    try {
      await this.pool.query(
        `INSERT INTO game_states (room_code, engine_state, player_count, player_colors, rankings, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (room_code) DO UPDATE SET
           engine_state  = EXCLUDED.engine_state,
           rankings      = EXCLUDED.rankings,
           updated_at    = NOW()`,
        [
          roomCode,
          JSON.stringify(gameEngine.getGameState()),
          gameEngine.playerCount,
          gameEngine.playerColors,
          gameEngine.rankings ?? [],
        ],
      );
    } catch (e) {
      console.error("PgStore.saveGameState error:", e.message);
    }
  }

  async updatePlayerSocket(userId, socketId, connected) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `UPDATE players SET socket_id = $1, connected = $2 WHERE user_id = $3`,
        [socketId, connected, userId],
      );
    } catch (e) {
      console.error("PgStore.updatePlayerSocket error:", e.message);
    }
  }

  async removePlayer(userId) {
    if (!this.pool) return;
    try {
      await this.pool.query(`DELETE FROM players WHERE user_id = $1`, [userId]);
    } catch (e) {
      console.error("PgStore.removePlayer error:", e.message);
    }
  }

  async deleteRoom(roomCode) {
    if (!this.pool) return;
    try {
      // CASCADE deletes players + game_states
      await this.pool.query(`DELETE FROM rooms WHERE code = $1`, [roomCode]);
    } catch (e) {
      console.error("PgStore.deleteRoom error:", e.message);
    }
  }

  // ── Restore (load all active rooms on server boot) ──────────────────────

  async loadAllRooms() {
    if (!this.pool) return [];
    try {
      const { rows: rooms } = await this.pool.query(
        `SELECT * FROM rooms WHERE game_ended = FALSE ORDER BY created_at`,
      );

      const result = [];

      for (const r of rooms) {
        const { rows: players } = await this.pool.query(
          `SELECT * FROM players WHERE room_code = $1 ORDER BY player_index`,
          [r.code],
        );

        const { rows: gsRows } = await this.pool.query(
          `SELECT * FROM game_states WHERE room_code = $1`,
          [r.code],
        );

        result.push({
          room: {
            code: r.code,
            hostUserId: r.host_user_id,
            playerCount: r.player_count,
            colorOrder: r.color_order,
            gameStarted: r.game_started,
            gameEnded: r.game_ended,
            createdAt: new Date(r.created_at).getTime(),
          },
          players: players.map((p) => ({
            userId: p.user_id,
            sessionId: p.session_id,
            socketId: p.socket_id,
            username: p.username,
            avatar: p.avatar,
            color: p.color,
            playerIndex: p.player_index,
            ready: p.ready,
            connected: p.connected,
            left: p.left_game,
          })),
          gameState: gsRows[0]
            ? {
                engineState: gsRows[0].engine_state,
                playerCount: gsRows[0].player_count,
                playerColors: gsRows[0].player_colors,
                rankings: gsRows[0].rankings,
              }
            : null,
        });
      }

      return result;
    } catch (e) {
      console.error("PgStore.loadAllRooms error:", e.message);
      return [];
    }
  }

  /** Look up a player row by session credentials (for reconnection). */
  async findPlayerBySession(sessionId, userId) {
    if (!this.pool) return null;
    try {
      const { rows } = await this.pool.query(
        `SELECT p.*, r.game_started, r.game_ended
         FROM players p JOIN rooms r ON r.code = p.room_code
         WHERE p.session_id = $1 AND p.user_id = $2`,
        [sessionId, userId],
      );
      return rows[0] ?? null;
    } catch (e) {
      console.error("PgStore.findPlayerBySession error:", e.message);
      return null;
    }
  }
}
