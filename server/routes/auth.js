import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getPgPool } from "../db/pg.js";
import { AVATARS } from "../gameEngine/constants.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "ludo-secret-key-2026";
const JWT_EXPIRES_IN = "30d";

// ── Validation helpers ────────────────────────────────────────────────────

const NAME_RE = /^[a-zA-Z]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_PHONE_RE = /^(\+91)?[6-9]\d{9}$/;

function validateRegistration(body) {
  const { firstName, lastName, email, phone, password } = body;

  if (!firstName || !NAME_RE.test(firstName))
    return "First name must contain only letters";
  if (!lastName || !NAME_RE.test(lastName))
    return "Last name must contain only letters";
  if (!email || !EMAIL_RE.test(email)) return "Invalid email address";
  if (!phone || !INDIAN_PHONE_RE.test(phone.replace(/\s/g, "")))
    return "Invalid Indian phone number";
  if (!password || password.length < 6)
    return "Password must be at least 6 characters";
  return null;
}

// ── Generate unique username ──────────────────────────────────────────────

async function generateUsername(pool, firstName, lastName) {
  const base = `${firstName}${lastName}`.toLowerCase().slice(0, 20);
  // Try base first
  const { rows } = await pool.query("SELECT 1 FROM users WHERE username = $1", [
    base,
  ]);
  if (rows.length === 0) return base;

  // Append incrementing number
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base.slice(0, 18)}${i}`;
    const { rows: r } = await pool.query(
      "SELECT 1 FROM users WHERE username = $1",
      [candidate],
    );
    if (r.length === 0) return candidate;
  }
  // Fallback: base + random suffix
  return `${base.slice(0, 14)}${Date.now().toString(36)}`;
}

// ── POST /api/auth/register ───────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: "Database unavailable" });

  const err = validateRegistration(req.body);
  if (err) return res.status(400).json({ error: err });

  const { firstName, lastName, email, phone, password } = req.body;
  const normalizedPhone = phone.replace(/\s/g, "");

  try {
    // Check duplicates
    const { rows: existing } = await pool.query(
      "SELECT email, phone FROM users WHERE email = $1 OR phone = $2",
      [email.toLowerCase(), normalizedPhone],
    );
    if (existing.length > 0) {
      if (existing[0].email === email.toLowerCase())
        return res.status(409).json({ error: "Email already registered" });
      return res.status(409).json({ error: "Phone number already registered" });
    }

    const username = await generateUsername(pool, firstName, lastName);
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (first_name, last_name, username, email, phone, password_hash, avatar)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, first_name, last_name, username, email, phone, avatar, created_at`,
      [
        firstName.trim(),
        lastName.trim(),
        username,
        email.toLowerCase().trim(),
        normalizedPhone,
        passwordHash,
        avatar,
      ],
    );

    const user = rows[0];
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (e) {
    console.error("Register error:", e.message);
    if (e.code === "23505") {
      return res.status(409).json({ error: "Account already exists" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: "Database unavailable" });

  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);

    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (e) {
    console.error("Login error:", e.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "No token provided" });

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const pool = getPgPool();
    if (!pool) return res.status(503).json({ error: "Database unavailable" });

    const { rows } = await pool.query(
      "SELECT id, first_name, last_name, username, email, phone, avatar FROM users WHERE id = $1",
      [payload.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        username: u.username,
        email: u.email,
        phone: u.phone,
        avatar: u.avatar,
      },
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
export { JWT_SECRET };
