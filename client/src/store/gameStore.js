import { create } from "zustand";

export const useGameStore = create((set, get) => ({
  room: null,
  gameState: null,
  currentUser: null,
  diceValue: null,
  isRolling: false,
  movesAvailable: [],
  selectedToken: null,
  winner: null,
  rankings: [],
  chatMessages: [],
  unreadMessages: 0,
  chatOpen: false,
  turnExpiresAt: null,
  playersStatus: [], // [{ userId, status: 'active'|'away'|'disconnected' }]
  // Token animation direction: { playerIndex, tokenIndex, direction } or null
  moveAnimation: null,

  setRoom: (room) => set({ room }),

  setGameState: (gameStateOrUpdater) => {
    if (typeof gameStateOrUpdater === "function") {
      set((state) => ({ gameState: gameStateOrUpdater(state.gameState) }));
    } else {
      set({ gameState: gameStateOrUpdater });
    }
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  setDiceValue: (value) => set({ diceValue: value }),

  setIsRolling: (isRolling) => set({ isRolling }),

  setMovesAvailable: (moves) => set({ movesAvailable: moves }),

  setSelectedToken: (token) => set({ selectedToken: token }),

  setWinner: (winner) => set({ winner }),

  setRankings: (rankings) => set({ rankings }),

  setTurnExpiresAt: (ts) => set({ turnExpiresAt: ts }),

  setPlayersStatus: (statuses) => set({ playersStatus: statuses }),

  setMoveAnimation: (anim) => set({ moveAnimation: anim }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
      unreadMessages: state.chatOpen ? 0 : state.unreadMessages + 1,
    })),

  setChatOpen: (isOpen) =>
    set({
      chatOpen: isOpen,
      unreadMessages: isOpen ? 0 : get().unreadMessages,
    }),

  clearUnreadMessages: () => set({ unreadMessages: 0 }),

  reset: () =>
    set({
      room: null,
      gameState: null,
      diceValue: null,
      isRolling: false,
      movesAvailable: [],
      selectedToken: null,
      winner: null,
      rankings: [],
      chatMessages: [],
      unreadMessages: 0,
      chatOpen: false,
      moveAnimation: null,
      turnExpiresAt: null,
      playersStatus: [],
    }),
}));
