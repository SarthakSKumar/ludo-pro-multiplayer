import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUserStore = create(
  persist(
    (set) => ({
      username: "",
      avatar: "",
      sessionId: null,
      userId: null,
      currentRoomCode: null,

      setUsername: (username) => set({ username }),

      setAvatar: (avatar) => set({ avatar }),

      setSessionId: (sessionId) => set({ sessionId }),

      setUserId: (userId) => set({ userId }),

      setCurrentRoomCode: (roomCode) => set({ currentRoomCode: roomCode }),

      // Persist full session payload from server on join/create
      setSession: ({ sessionId, userId, username, roomCode }) =>
        set({ sessionId, userId, username, currentRoomCode: roomCode }),

      clearUser: () =>
        set({
          username: "",
          avatar: "",
          sessionId: null,
          userId: null,
          currentRoomCode: null,
        }),
    }),
    {
      name: "ludo-user-storage",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) =>
          localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
