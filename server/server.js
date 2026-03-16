import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { RoomManager } from "./roomManager/RoomManager.js";
import { setupSocketHandlers } from "./socket/socketHandlers.js";
import { initPgPool, getPgPool } from "./db/pg.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow any localhost origin
    if (
      process.env.NODE_ENV === "development" &&
      origin.startsWith("http://localhost")
    ) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
});

app.use("/api/", limiter);

// Auth routes
app.use("/api/auth", authRoutes);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Redis setup for Socket.IO adapter and session store
let redisClient = null;
let redisSessionClient = null;

async function setupRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("⚠️  No REDIS_URL set — running without Redis adapter");
    return;
  }
  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    redisSessionClient = pubClient.duplicate();

    // Attach runtime error handlers so a transient Redis disconnect
    // doesn't crash the process via an unhandled 'error' event.
    pubClient.on("error", (err) =>
      console.error("Redis pub error:", err.message),
    );
    subClient.on("error", (err) =>
      console.error("Redis sub error:", err.message),
    );
    redisSessionClient.on("error", (err) =>
      console.error("Redis session error:", err.message),
    );

    await Promise.all([
      pubClient.connect(),
      subClient.connect(),
      redisSessionClient.connect(),
    ]);

    io.adapter(createAdapter(pubClient, subClient));
    redisClient = pubClient;
    console.log("✅ Redis adapter connected");
  } catch (err) {
    console.error(
      "❌ Redis connection failed — running without adapter:",
      err.message,
    );
  }
}

// Initialize room manager (pass redis session client for persistence)
// PG pool is attached after initPgPool() in the boot sequence below.
const roomManager = new RoomManager(redisSessionClient);

// Boot sequence
(async () => {
  // 1. External stores
  await setupRedis();
  roomManager.redis = redisSessionClient;

  const pgPool = await initPgPool();
  roomManager.setPgPool(pgPool);

  // Parse Redis connection options for BullMQ (needs host/port, not the client)
  let bullmqConnection = null;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      bullmqConnection = {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password || undefined,
        username:
          parsed.username && parsed.username !== "default"
            ? parsed.username
            : undefined,
      };
    } catch (e) {
      console.error("Failed to parse REDIS_URL for BullMQ:", e.message);
    }
  }

  // JWT middleware for Socket.IO — authenticate every connection
  const JWT_SECRET = process.env.JWT_SECRET || "ludo-secret-key-2026";
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = payload; // { id, username, avatar, email }
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // Setup socket handlers (pass BullMQ-compatible connection options)
  setupSocketHandlers(io, roomManager, bullmqConnection);

  // Restore rooms: prefer PG (source of truth), fall back to Redis
  if (pgPool) {
    await roomManager.restoreFromPg();
  } else {
    await roomManager.restoreFromRedis();
  }

  const PORT = process.env.PORT || 4001;
  httpServer.listen(PORT, () => {
    console.log(`🎮 Ludo server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`CORS origin: ${process.env.CORS_ORIGIN}`);
  });
})();

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    stats: roomManager.getRoomStats(),
  });
});

// Get room info (for debugging) — strip sensitive fields
app.get("/api/room/:code", (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (room) {
    const safe = {
      ...room,
      players: room.players.map(({ socketId, sessionId, ...rest }) => rest),
    };
    res.json(safe);
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
});

// Catch uncaught errors (ECONNRESET etc.) so the process doesn't crash
process.on("uncaughtException", (err) => {
  if (err.code === "ECONNRESET") {
    console.warn("ECONNRESET caught — connection was reset by peer");
  } else {
    console.error("Uncaught exception:", err);
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
