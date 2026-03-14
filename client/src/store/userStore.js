import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUserStore = create(
  persist(
    (set) => ({
      // Auth
      token: null,

      // User profile (from auth response)
      userId: null,
      username: "",
      avatar: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",

      // Room session
      sessionId: null,
      currentRoomCode: null,

      /** Called after login/register */
      setAuth: ({ token, user }) =>
        set({
          token,
          userId: user.id,
          username: user.username,
          avatar: user.avatar,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
        }),

      logout: () =>
        set({
          token: null,
          userId: null,
          username: "",
          avatar: "",
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          sessionId: null,
          currentRoomCode: null,
        }),

      setCurrentRoomCode: (roomCode) => set({ currentRoomCode: roomCode }),

      setSession: ({ sessionId, userId, username, roomCode }) =>
        set({ sessionId, userId, username, currentRoomCode: roomCode }),

      clearUser: () =>
        set({
          sessionId: null,
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
