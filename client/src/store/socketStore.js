import { create } from "zustand";
import io from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,
  connectionStatus: "disconnected", // 'connected' | 'connecting' | 'disconnected'
  error: null,

  initialize: () => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
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
      console.error("Connection error:", error);
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
   * If already connected, resolves immediately.
   * Rejects after `timeoutMs` if connection doesn't happen.
   */
  waitForConnection: (timeoutMs = 10000) => {
    return new Promise((resolve, reject) => {
      const { socket } = get();
      if (!socket) return reject(new Error("Socket not initialized"));
      if (socket.connected) return resolve();

      const timer = setTimeout(() => {
        socket.off("connect", onConnect);
        reject(new Error("Socket connection timeout"));
      }, timeoutMs);

      const onConnect = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.once("connect", onConnect);
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
