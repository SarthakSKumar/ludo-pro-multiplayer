import { Queue, Worker } from "bullmq";
import { TURN_TIMEOUT } from "../gameEngine/constants.js";

/**
 * Creates the turn-timer subsystem.
 * Handles BullMQ queue + in-memory fallback timers.
 * Call setDispatch() after game actions are initialised to wire up job callbacks.
 *
 * @param {import("socket.io").Server} io
 * @param {import("../roomManager/RoomManager.js").RoomManager} roomManager
 * @param {object|null} redisConnection
 */
export function createTimerManager(io, roomManager, redisConnection) {
  let timerQueue = null;
  let timerWorker = null;
  let _dispatch = null; // (type: string, roomCode: string) => void

  if (redisConnection) {
    timerQueue = new Queue("turn-timers", { connection: redisConnection });

    timerWorker = new Worker(
      "turn-timers",
      async (job) => {
        try {
          const { roomCode, type } = job.data;
          _dispatch?.(type, roomCode);
        } catch (err) {
          console.error("Timer job error:", err);
        }
      },
      { connection: redisConnection },
    );

    timerWorker.on("error", (err) => {
      console.error("BullMQ worker error:", err.message);
    });
  }

  // Fallback in-memory timers used when Redis is unavailable
  const roomTimers = new Map();

  /** Register the game-action dispatcher called when a timer fires. */
  function setDispatch(fn) {
    _dispatch = fn;
  }

  async function clearRoomTimers(roomCode) {
    if (timerQueue) {
      try {
        const ids = [
          `roll-${roomCode}`,
          `move-${roomCode}`,
          `pass-${roomCode}`,
          `resetDice-${roomCode}`,
        ];
        await Promise.all(
          ids.map((id) => timerQueue.remove(id).catch(() => {})),
        );
      } catch (e) {
        console.error("Failed to clear BullMQ timers:", e.message);
      }
    }
    const timers = roomTimers.get(roomCode);
    if (timers) {
      if (timers.rollTimer) clearTimeout(timers.rollTimer);
      if (timers.moveTimer) clearTimeout(timers.moveTimer);
      roomTimers.delete(roomCode);
    }
  }

  async function clearRollTimer(roomCode) {
    if (timerQueue) {
      try {
        await timerQueue.remove(`roll-${roomCode}`).catch(() => {});
      } catch (e) {
        /* ignore */
      }
    }
    const timers = roomTimers.get(roomCode);
    if (timers?.rollTimer) {
      clearTimeout(timers.rollTimer);
      timers.rollTimer = null;
    }
  }

  async function clearMoveTimer(roomCode) {
    if (timerQueue) {
      try {
        await Promise.all([
          timerQueue.remove(`move-${roomCode}`).catch(() => {}),
          timerQueue.remove(`pass-${roomCode}`).catch(() => {}),
          timerQueue.remove(`resetDice-${roomCode}`).catch(() => {}),
        ]);
      } catch (e) {
        /* ignore */
      }
    }
    const timers = roomTimers.get(roomCode);
    if (timers?.moveTimer) {
      clearTimeout(timers.moveTimer);
      timers.moveTimer = null;
    }
  }

  function emitTurnTimer(roomCode, delayMs) {
    const expiresAt = Date.now() + delayMs;
    io.to(roomCode).emit("turn_timer", { expiresAt });
  }

  async function startRollTimer(roomCode) {
    const fullRoom = roomManager.rooms.get(roomCode);
    const currentIdx = fullRoom?.gameEngine?.currentPlayerIndex;
    const currentRoomPlayer = fullRoom?.players?.[currentIdx];
    const isDisconnected =
      currentRoomPlayer &&
      (!currentRoomPlayer.connected || currentRoomPlayer.left);
    const delay = isDisconnected ? 2000 : TURN_TIMEOUT * 1000;
    emitTurnTimer(roomCode, delay);

    if (timerQueue) {
      try {
        await timerQueue.remove(`roll-${roomCode}`).catch(() => {});
        await timerQueue.add(
          "roll",
          { roomCode, type: "roll" },
          {
            delay,
            jobId: `roll-${roomCode}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
        return;
      } catch (e) {
        console.error("BullMQ add roll timer failed, falling back:", e.message);
      }
    }
    const timers = roomTimers.get(roomCode) || {};
    if (timers.rollTimer) clearTimeout(timers.rollTimer);
    timers.rollTimer = setTimeout(() => {
      timers.rollTimer = null;
      _dispatch?.("roll", roomCode);
    }, delay);
    roomTimers.set(roomCode, timers);
  }

  async function startMoveTimer(roomCode, delay = 30000) {
    emitTurnTimer(roomCode, delay);

    if (timerQueue) {
      try {
        await timerQueue.remove(`move-${roomCode}`).catch(() => {});
        await timerQueue.add(
          "move",
          { roomCode, type: "move" },
          {
            delay,
            jobId: `move-${roomCode}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
        return;
      } catch (e) {
        console.error("BullMQ add move timer failed, falling back:", e.message);
      }
    }
    const timers = roomTimers.get(roomCode) || {};
    if (timers.moveTimer) clearTimeout(timers.moveTimer);
    timers.moveTimer = setTimeout(() => {
      timers.moveTimer = null;
      _dispatch?.("move", roomCode);
    }, delay);
    roomTimers.set(roomCode, timers);
  }

  async function schedulePassTurn(roomCode) {
    const delay = 2000;
    if (timerQueue) {
      try {
        await timerQueue.remove(`pass-${roomCode}`).catch(() => {});
        await timerQueue.add(
          "pass",
          { roomCode, type: "pass" },
          {
            delay,
            jobId: `pass-${roomCode}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
        return;
      } catch (e) {
        /* fallback */
      }
    }
    setTimeout(() => _dispatch?.("pass", roomCode), delay);
  }

  async function scheduleResetDice(roomCode) {
    const delay = 2000;
    if (timerQueue) {
      try {
        await timerQueue.remove(`resetDice-${roomCode}`).catch(() => {});
        await timerQueue.add(
          "resetDice",
          { roomCode, type: "resetDice" },
          {
            delay,
            jobId: `resetDice-${roomCode}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
        return;
      } catch (e) {
        /* fallback */
      }
    }
    setTimeout(() => _dispatch?.("resetDice", roomCode), delay);
  }

  /** Shut down BullMQ worker on process exit. */
  async function shutdown() {
    if (timerWorker) await timerWorker.close().catch(() => {});
    if (timerQueue) await timerQueue.close().catch(() => {});
  }

  return {
    setDispatch,
    clearRoomTimers,
    clearRollTimer,
    clearMoveTimer,
    emitTurnTimer,
    startRollTimer,
    startMoveTimer,
    schedulePassTurn,
    scheduleResetDice,
    shutdown,
  };
}
