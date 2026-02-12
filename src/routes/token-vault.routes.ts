/**
 * Token Vault Routes
 * Secure storage and retrieval of OAuth tokens for OpenClaw sync
 *
 * - PUT / — store encrypted tokens array (admin JWT required)
 * - GET / — pull decrypted tokens (JWT auth required)
 */

import { Router } from "express";
import crypto from "node:crypto";
import { authMiddleware } from "../middleware/auth.middleware";
import { settingsRepo } from "../db/models/settings";
import { Errors } from "../core/errors/api-error";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

const SETTINGS_KEY = "anthropic_oauth_tokens";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(blob: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = blob.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// All endpoints require JWT login
router.use(authMiddleware);

/**
 * PUT / — Store tokens array (admin only)
 * Body: { tokens: ["sk-ant-...", "sk-ant-...", ...] }
 * Also accepts legacy { token: "sk-ant-..." } for single token
 */
router.put("/", asyncHandler(async (req, res, next) => {
  try {
    const { tokens, token } = req.body;

    // Accept array or single token (backward compat)
    const tokenList: string[] = Array.isArray(tokens)
      ? tokens
      : token && typeof token === "string"
        ? [token]
        : [];

    if (tokenList.length === 0 || tokenList.some((t: unknown) => typeof t !== "string" || !t)) {
      throw Errors.validation("tokens array is required (non-empty strings)");
    }

    // Encrypt each token individually, store as JSON array
    const encryptedList = tokenList.map((t: string) => encrypt(t));
    await settingsRepo.setSetting(SETTINGS_KEY, JSON.stringify(encryptedList));

    res.json({ success: true, message: `${tokenList.length} token(s) stored` });
  } catch (err) {
    next(err);
  }
}));

/**
 * GET / — Pull tokens (any authenticated user)
 */
router.get("/", asyncHandler(async (_req, res, next) => {
  try {
    const raw = await settingsRepo.getSetting(SETTINGS_KEY);
    if (!raw) {
      throw Errors.notFound("No tokens stored");
    }

    const encryptedList: string[] = JSON.parse(raw);
    const tokens = encryptedList.map((blob: string) => decrypt(blob));
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}));

/**
 * GET /auth-profiles — Returns auth-profiles.json content ready to write to file
 * Client-side script calls this endpoint and saves response directly
 */
router.get("/auth-profiles", asyncHandler(async (_req, res, next) => {
  try {
    const raw = await settingsRepo.getSetting(SETTINGS_KEY);
    if (!raw) {
      // Return empty profiles (same as logout/clear)
      res.json({ version: 1, profiles: {}, lastGood: {} });
      return;
    }

    const encryptedList: string[] = JSON.parse(raw);
    const tokens = encryptedList.map((blob: string) => decrypt(blob));

    const profiles: Record<string, { type: string; provider: string; token: string }> = {};
    tokens.forEach((token, i) => {
      const name = i === 0 ? "anthropic:default" : `anthropic:pool-${i}`;
      profiles[name] = { type: "token", provider: "anthropic", token };
    });

    res.json({ version: 1, profiles, lastGood: { anthropic: "anthropic:default" } });
  } catch (err) {
    next(err);
  }
}));

/**
 * DELETE / — Remove stored token (admin only)
 */
router.delete("/", asyncHandler(async (_req, res, next) => {
  try {
    await settingsRepo.deleteSetting(SETTINGS_KEY);
    res.json({ success: true, message: "Token removed" });
  } catch (err) {
    next(err);
  }
}));

export const tokenVaultRoutes = router;
export default router;
