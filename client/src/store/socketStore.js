import { create } from "zustand";
import io from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,
  connectionStatus: "disconnected", // 'connected' | 'connecting' | 'disconnected'
  error: null,

  initialize: (token) => {
    // Prevent double init
    const existing = get().socket;
    if (existing) {
      existing.disconnect();
    }

    const socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      set({ connected: true, connectionStatus: "connected", error: null });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      set({ connected: false, connectionStatus: "disconnected" });
    });

    socket.on("reconnect_attempt", () => {
      set({ connectionStatus: "connecting" });
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
      set({ error: error.message, connectionStatus: "connecting" });
    });

    socket.on("server_error", (data) => {
      console.error("Server error:", data.message);
      set({ error: data.message });
    });

    set({ socket, connectionStatus: "connecting" });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false, connectionStatus: "disconnected" });
    }
  },

  emit: (event, data) => {
    return new Promise((resolve, reject) => {
      const { socket } = get();
      if (!socket || !socket.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      socket.emit(event, data, (response) => {
        if (response && response.success === false) {
          reject(new Error(response.error || "Request failed"));
        } else {
          resolve(response);
        }
      });
    });
  },

  /**
   * Returns a Promise that resolves once the socket is connected.
   * Handles the case where socket is not yet initialized (polls until it appears).
   */
  waitForConnection: (timeoutMs = 10000) => {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;

      const attempt = () => {
        if (Date.now() > deadline) {
          return reject(new Error("Socket connection timeout"));
        }

        const { socket } = get();

        if (socket?.connected) {
          return resolve();
        }

        if (socket) {
          // Socket exists but not yet connected — wait for connect event
          const remaining = deadline - Date.now();
          const timer = setTimeout(() => {
            socket.off("connect", onConnect);
            reject(new Error("Socket connection timeout"));
          }, remaining);

          const onConnect = () => {
            clearTimeout(timer);
            resolve();
          };
          socket.once("connect", onConnect);
        } else {
          // Socket not yet initialized — retry shortly
          setTimeout(attempt, 50);
        }
      };

      attempt();
    });
  },

  on: (event, callback) => {
    const { socket } = get();
    if (socket) {
      socket.on(event, callback);
    }
  },

  off: (event, callback) => {
    const { socket } = get();
    if (socket) {
      socket.off(event, callback);
    }
  },
}));
