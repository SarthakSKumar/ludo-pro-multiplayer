import { TURN_TIMEOUT, AUTO_MOVE_DELAY_MS } from "../gameEngine/constants.js";

/**
 * Creates game-execution helpers that operate on room state.
 * Depends on timerManager for scheduling and io for emitting.
 *
 * @param {import("socket.io").Server} io
 * @param {import("../roomManager/RoomManager.js").RoomManager} roomManager
 * @param {ReturnType<import("./timerManager.js").createTimerManager>} timerManager
 */
export function createGameActions(io, roomManager, timerManager) {
  const {
    clearRoomTimers,
    startRollTimer,
    startMoveTimer,
    schedulePassTurn,
    scheduleResetDice,
  } = timerManager;

  // ── Turn helpers ───────────────────────────────────────────────────────────

  /**
   * Advance to the next active player, skipping disconnected/left/won players.
   * "Won" means all tokens reached home.
   */
  function advanceTurnSkippingDisconnected(roomCode) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine || fullRoom.gameEnded) return;
    const gameEngine = fullRoom.gameEngine;

    const maxAttempts = fullRoom.players.length;
    for (let i = 0; i < maxAttempts; i++) {
      gameEngine.nextTurn();
      const idx = gameEngine.currentPlayerIndex;
      const roomPlayer = fullRoom.players[idx];
      const gsPlayer = gameEngine.gameState.players[idx];
      const hasFinished = gsPlayer && gsPlayer.tokens.every((t) => t.inHome);
      if (
        roomPlayer &&
        roomPlayer.connected &&
        !roomPlayer.left &&
        !hasFinished
      )
        break;
    }
    roomManager._saveRoom(roomCode);
  }

  function executePassTurn(roomCode) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine || fullRoom.gameEnded) return;
    advanceTurnSkippingDisconnected(roomCode);
    const gameEngine = fullRoom.gameEngine;
    io.to(roomCode).emit("turn_changed", {
      currentPlayerIndex: gameEngine.currentPlayerIndex,
    });
    startRollTimer(roomCode);
  }

  function executeResetDice(roomCode) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine || fullRoom.gameEnded) return;
    const gameEngine = fullRoom.gameEngine;
    gameEngine.gameState.diceValue = null;
    gameEngine.gameState.movesAvailable = [];
    roomManager._saveRoom(roomCode);
    io.to(roomCode).emit("turn_changed", {
      currentPlayerIndex: gameEngine.currentPlayerIndex,
    });
    startRollTimer(roomCode);
  }

  // ── Post-move outcome helper ───────────────────────────────────────────────

  /**
   * Handle aftermath of a token move: rankings, game-over, or next turn.
   * Called from both move_token handler and executeAutoMoveToken.
   */
  function handleMoveOutcome(roomCode, result, playerIndex, tokenIndex) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine) return;
    const gameEngine = fullRoom.gameEngine;

    if (gameEngine.gameState.gameEnded) {
      // Build ranked player list (playerIndex order = finish order)
      const rankingsData = gameEngine.rankings.map((pi, rank) => ({
        rank: rank + 1,
        playerIndex: pi,
        ...fullRoom.players[pi],
      }));

      io.to(roomCode).emit("game_ended", {
        winner: gameEngine.rankings[0],
        winnerData: fullRoom.players[gameEngine.rankings[0]],
        rankings: rankingsData,
        gameState: gameEngine.getGameState(),
      });
      fullRoom.gameEnded = true;
      clearRoomTimers(roomCode);
    } else if (result.hasWon) {
      // Player finished but game continues for others
      advanceTurnSkippingDisconnected(roomCode);
      startRollTimer(roomCode);
    } else if (result.hasExtraTurn) {
      // Same player rolls again — start move timer only if they still have
      // moves available after reset (handled by handlePostDiceRoll path).
      // Here we just start the roll timer so they can re-roll.
      startRollTimer(roomCode);
    } else {
      startRollTimer(roomCode);
    }
  }

  // ── Auto-move helpers ──────────────────────────────────────────────────────

  function autoMoveToken(roomCode) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine || fullRoom.gameEnded) return;
    const gameEngine = fullRoom.gameEngine;
    const diceValue = gameEngine.gameState.diceValue;
    if (diceValue === null) return;

    const moves = gameEngine.gameState.movesAvailable;
    if (moves.length === 0) return;

    const playerIndex = gameEngine.currentPlayerIndex;
    const player = gameEngine.gameState.players[playerIndex];

    let tokenIndex;
    if (diceValue === 6) {
      const baseMove = moves.find((m) => player.tokens[m.tokenIndex].inBase);
      tokenIndex = baseMove ? baseMove.tokenIndex : moves[0].tokenIndex;
    } else {
      tokenIndex = moves[0].tokenIndex;
    }

    executeAutoMoveToken(roomCode, tokenIndex);
  }

  function executeAutoMoveToken(roomCode, tokenIndex) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine || fullRoom.gameEnded) return;
    const gameEngine = fullRoom.gameEngine;
    const diceValue = gameEngine.gameState.diceValue;
    if (diceValue === null) return;

    const playerIndex = gameEngine.currentPlayerIndex;
    const result = gameEngine.moveToken(playerIndex, tokenIndex, diceValue);

    if (!result.success) return;

    roomManager._saveRoom(roomCode);

    io.to(roomCode).emit("token_moved", {
      playerIndex,
      tokenIndex,
      newPosition: result.newPosition,
      capturedToken: result.capturedToken,
      hasExtraTurn: result.hasExtraTurn,
      reachedHome: result.reachedHome,
      rankings: gameEngine.rankings,
      gameState: gameEngine.getGameState(),
      autoMoved: true,
    });

    handleMoveOutcome(roomCode, result, playerIndex, tokenIndex);
  }

  // ── Dice roll helpers ──────────────────────────────────────────────────────

  function executeDiceRoll(roomCode) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine || fullRoom.gameEnded) return;
    const gameEngine = fullRoom.gameEngine;
    if (gameEngine.gameState.diceValue !== null) return;

    const result = gameEngine.rollDice();
    roomManager._saveRoom(roomCode);

    io.to(roomCode).emit("dice_rolled", {
      playerIndex: gameEngine.currentPlayerIndex,
      value: result.value,
      movesAvailable: result.movesAvailable,
      hasExtraTurn: result.hasExtraTurn,
      autoRolled: true,
    });

    handlePostDiceRoll(roomCode, result);
  }

  function handlePostDiceRoll(roomCode, result) {
    const fullRoom = roomManager.rooms.get(roomCode);
    if (!fullRoom?.gameEngine || fullRoom.gameEnded) return;

    if (result.movesAvailable.length === 0) {
      if (!result.hasExtraTurn) {
        schedulePassTurn(roomCode);
      } else {
        scheduleResetDice(roomCode);
      }
    } else if (result.movesAvailable.length === 1) {
      startMoveTimer(roomCode, AUTO_MOVE_DELAY_MS);
    } else {
      const gameEngine = fullRoom.gameEngine;
      const player =
        gameEngine.gameState.players[gameEngine.currentPlayerIndex];
      const positions = result.movesAvailable.map((m) => {
        const token = player.tokens[m.tokenIndex];
        return token.inBase ? "base" : String(token.position);
      });
      const allSamePosition = positions.every((p) => p === positions[0]);

      if (allSamePosition) {
        startMoveTimer(roomCode, 2000);
      } else {
        startMoveTimer(roomCode, TURN_TIMEOUT * 1000);
      }
    }
  }

  return {
    advanceTurnSkippingDisconnected,
    executePassTurn,
    executeResetDice,
    autoMoveToken,
    executeAutoMoveToken,
    executeDiceRoll,
    handlePostDiceRoll,
    handleMoveOutcome,
  };
}
