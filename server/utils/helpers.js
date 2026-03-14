import crypto from "crypto";
import { AVATARS } from "../gameEngine/constants.js";

export function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

export function generateAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export function generateSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

export function validateUsername(username) {
  if (!username || typeof username !== "string") {
    return { valid: false, error: "Username is required" };
  }

  const trimmed = username.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: "Username must be at least 2 characters" };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: "Username must be less than 20 characters" };
  }

  return { valid: true, username: trimmed };
}

export function validateRoomCode(code) {
  if (!code || typeof code !== "string") {
    return false;
  }
  return code.length === 6 && /^[A-Z0-9]+$/.test(code);
}
