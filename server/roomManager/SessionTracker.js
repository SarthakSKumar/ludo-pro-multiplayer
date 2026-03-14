/**
 * Tracks the bidirectional mappings between sockets, sessions, and rooms,
 * plus the set of temporarily-disconnected players awaiting reconnection.
 *
 * Extracted from RoomManager to keep that class focused on room lifecycle.
 */
export class SessionTracker {
  constructor() {
    /** sessionId -> roomCode */
    this.sessionToRoom = new Map();
    /** sessionId -> current socketId */
    this.sessionToSocket = new Map();
    /** socketId -> sessionId */
    this.socketToSession = new Map();
    /** sessionId -> { roomCode, timestamp, playerIndex, socketId } */
    this.disconnectedPlayers = new Map();
  }

  /** Register a new player's session bindings. */
  register(sessionId, socketId, roomCode) {
    this.sessionToRoom.set(sessionId, roomCode);
    this.sessionToSocket.set(sessionId, socketId);
    this.socketToSession.set(socketId, sessionId);
  }

  /** Update socket mapping when a player reconnects with a new socket. */
  updateSocket(sessionId, oldSocketId, newSocketId) {
    this.sessionToSocket.set(sessionId, newSocketId);
    this.socketToSession.delete(oldSocketId);
    this.socketToSession.set(newSocketId, sessionId);
    this.disconnectedPlayers.delete(sessionId);
  }

  /** Remove all mappings for a player (on leave/kick). */
  remove(sessionId, socketId) {
    if (sessionId) {
      this.sessionToRoom.delete(sessionId);
      this.sessionToSocket.delete(sessionId);
      this.disconnectedPlayers.delete(sessionId);
    }
    if (socketId) {
      this.socketToSession.delete(socketId);
    }
  }

  getRoom(sessionId) {
    return this.sessionToRoom.get(sessionId);
  }

  getSocket(sessionId) {
    return this.sessionToSocket.get(sessionId);
  }

  getSession(socketId) {
    return this.socketToSession.get(socketId);
  }

  markDisconnected(sessionId, info) {
    this.disconnectedPlayers.set(sessionId, info);
  }

  clearDisconnected(sessionId) {
    this.disconnectedPlayers.delete(sessionId);
  }

  getDisconnected(sessionId) {
    return this.disconnectedPlayers.get(sessionId);
  }

  get disconnectedCount() {
    return this.disconnectedPlayers.size;
  }
}
