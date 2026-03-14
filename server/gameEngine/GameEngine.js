import {
  COLORS,
  TOKENS_PER_PLAYER,
  BOARD_SIZE,
  START_POSITIONS,
  HOME_ENTRIES,
  SAFE_POSITIONS,
  WINNING_POSITION,
  UNLOCK_NUMBER,
  DICE_MIN,
  DICE_MAX,
} from "./constants.js";

export class GameEngine {
  constructor(playerCount = 4, playerColors = null) {
    this.playerCount = playerCount;
    this.playerColors = playerColors || COLORS.slice(0, playerCount);
    this.currentPlayerIndex = 0;
    this.gameState = this.initializeGame();
    this.winner = null;
    this.rankings = []; // playerIndex array in finish order
    this.lastDiceRoll = null;
  }

  initializeGame() {
    const players = this.playerColors.map((color, index) => ({
      id: index,
      color,
      tokens: Array(TOKENS_PER_PLAYER)
        .fill(null)
        .map((_, tokenIndex) => ({
          id: tokenIndex,
          position: -1, // -1 means in base
          inBase: true,
          inHome: false,
          onBoard: false,
        })),
    }));

    return {
      players,
      currentPlayerIndex: 0,
      diceValue: null,
      lastRoll: null,
      movesAvailable: [],
      gameStarted: false,
      gameEnded: false,
    };
  }

  rollDice() {
    const value =
      Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1)) + DICE_MIN;
    this.lastDiceRoll = value;
    this.gameState.diceValue = value;
    this.gameState.lastRoll = Date.now();

    // Calculate available moves
    this.gameState.movesAvailable = this.getAvailableMoves(
      this.currentPlayerIndex,
      value,
    );

    return {
      value,
      movesAvailable: this.gameState.movesAvailable,
      hasExtraTurn: value === UNLOCK_NUMBER,
    };
  }

  getAvailableMoves(playerIndex, diceValue) {
    const player = this.gameState.players[playerIndex];
    const moves = [];

    player.tokens.forEach((token, tokenIndex) => {
      if (this.canMoveToken(playerIndex, tokenIndex, diceValue)) {
        moves.push({
          tokenIndex,
          valid: true,
          newPosition: this.calculateNewPosition(
            playerIndex,
            tokenIndex,
            diceValue,
          ),
        });
      }
    });

    return moves;
  }

  canMoveToken(playerIndex, tokenIndex, diceValue) {
    const player = this.gameState.players[playerIndex];
    const token = player.tokens[tokenIndex];

    // Token already home
    if (token.inHome) return false;

    // Token in base - needs 6 to unlock
    if (token.inBase) {
      return diceValue === UNLOCK_NUMBER;
    }

    // Check if move would exceed winning position
    const newPos = this.calculateNewPosition(
      playerIndex,
      tokenIndex,
      diceValue,
    );
    if (newPos > WINNING_POSITION) return false;

    return true;
  }

  calculateNewPosition(playerIndex, tokenIndex, diceValue) {
    const player = this.gameState.players[playerIndex];
    const token = player.tokens[tokenIndex];
    const color = player.color;

    // Unlocking from base
    if (token.inBase) {
      return START_POSITIONS[color];
    }

    let newPosition = token.position + diceValue;
    const homeEntry = HOME_ENTRIES[color];

    // Already in home stretch (position >= 52) — just move forward
    if (token.position >= BOARD_SIZE) {
      return newPosition;
    }

    // Check if entering home stretch from main track
    if (token.position <= homeEntry && newPosition > homeEntry) {
      const stepsAfterEntry = newPosition - homeEntry;
      return BOARD_SIZE + stepsAfterEntry - 1; // 52=first home cell, 57=winning
    }

    // Wrap around the main board
    if (newPosition >= BOARD_SIZE) {
      newPosition = newPosition % BOARD_SIZE;
    }

    return newPosition;
  }

  moveToken(playerIndex, tokenIndex, diceValue) {
    if (playerIndex !== this.currentPlayerIndex) {
      return { success: false, error: "Not your turn" };
    }

    if (!this.canMoveToken(playerIndex, tokenIndex, diceValue)) {
      return { success: false, error: "Invalid move" };
    }

    const player = this.gameState.players[playerIndex];
    const token = player.tokens[tokenIndex];
    const color = player.color;

    // Calculate new position
    const newPosition = this.calculateNewPosition(
      playerIndex,
      tokenIndex,
      diceValue,
    );

    // Check for capture
    let capturedToken = null;
    if (newPosition < BOARD_SIZE && !SAFE_POSITIONS.includes(newPosition)) {
      capturedToken = this.checkCapture(playerIndex, newPosition);
    }

    // Update token position
    if (token.inBase) {
      token.inBase = false;
      token.onBoard = true;
      token.position = START_POSITIONS[color];
    } else {
      token.position = newPosition;
    }

    // Check if token reached home
    let reachedHome = false;
    if (newPosition >= WINNING_POSITION) {
      token.inHome = true;
      token.onBoard = false;
      reachedHome = true;
    }

    // Check win condition — player finished all tokens
    const hasWon = this.checkWinCondition(playerIndex);
    if (hasWon && !this.rankings.includes(playerIndex)) {
      this.rankings.push(playerIndex);
      // Game ends when only 1 (or 0) active player remains
      const remaining = this.gameState.players.filter(
        (_, i) => !this.rankings.includes(i),
      ).length;
      if (remaining <= 1) {
        // Add any unfinished players to rankings in current order
        this.gameState.players.forEach((_, i) => {
          if (!this.rankings.includes(i)) this.rankings.push(i);
        });
        this.winner = this.rankings[0];
        this.gameState.gameEnded = true;
      }
    }

    // Extra turn: rolled 6, captured a token, or reached home
    // Declare before the hasWon branch so it's always in scope for the return value.
    const hasExtraTurn =
      !hasWon &&
      (diceValue === UNLOCK_NUMBER || !!capturedToken || reachedHome);

    if (hasWon) {
      // Player finished — clear dice and hand off turn via advanceTurnSkippingDisconnected
      this.gameState.diceValue = null;
      this.gameState.movesAvailable = [];
    } else if (!hasExtraTurn) {
      this.nextTurn();
    } else {
      // Reset dice value so player can roll again
      this.gameState.diceValue = null;
      this.gameState.movesAvailable = [];
    }

    return {
      success: true,
      newPosition,
      capturedToken,
      hasExtraTurn,
      reachedHome,
      hasWon,
      winner: this.winner,
    };
  }

  checkCapture(currentPlayerIndex, position) {
    // Check if any opponent token is at this position
    for (let i = 0; i < this.gameState.players.length; i++) {
      if (i === currentPlayerIndex) continue;

      const opponent = this.gameState.players[i];
      for (let j = 0; j < opponent.tokens.length; j++) {
        const token = opponent.tokens[j];
        if (token.onBoard && token.position === position) {
          // Capture! Send back to base
          token.position = -1;
          token.inBase = true;
          token.onBoard = false;
          return { playerIndex: i, tokenIndex: j };
        }
      }
    }
    return null;
  }

  checkWinCondition(playerIndex) {
    const player = this.gameState.players[playerIndex];
    return player.tokens.every((token) => token.inHome);
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
    this.gameState.currentPlayerIndex = this.currentPlayerIndex;
    this.gameState.diceValue = null;
    this.gameState.movesAvailable = [];
  }

  getGameState() {
    return {
      ...this.gameState,
      currentPlayerIndex: this.currentPlayerIndex,
      winner: this.winner,
      rankings: [...this.rankings],
    };
  }

  canRollDice(playerIndex) {
    return (
      playerIndex === this.currentPlayerIndex &&
      this.gameState.diceValue === null
    );
  }
}
