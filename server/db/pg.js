import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

/**
 * Create and export a shared connection pool.
 * Returns null when DATABASE_URL is not set so the app can run without PG.
 */
let pool = null;

export function getPgPool() {
  return pool;
}

export async function initPgPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("⚠️  No DATABASE_URL set — running without PostgreSQL");
    return null;
  }

  try {
    pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false,  },
      max: 10,
      idleTimeoutMillis: 30_000,
      family: 6,
    });

    // Verify connectivity
    const client = await pool.connect();
    client.release();
    console.log("✅ PostgreSQL connected");
    return pool;
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
    pool = null;
    return null;
  }
}
