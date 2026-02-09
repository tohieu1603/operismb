/**
 * JWT utilities
 */

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// Secret keys — required via env, no fallback
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`[jwt] ${name} must be set in environment variables`);
  return val;
}

const ACCESS_SECRET = requireEnv("JWT_ACCESS_SECRET");
const REFRESH_SECRET = requireEnv("JWT_REFRESH_SECRET");

// Token expiration
const ACCESS_EXPIRES_IN = "1h";
const REFRESH_EXPIRES_IN = "7d";
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export interface TokenPayload {
  userId: string;
  email: string;
  role: "admin" | "user";
}

export interface RefreshTokenClaims extends TokenPayload {
  jti: string;    // unique token ID
  family: string; // token family for reuse detection
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface GenerateTokensOptions {
  family?: string; // reuse existing family on refresh; omit for new login
}

export function generateTokens(payload: TokenPayload, options?: GenerateTokensOptions): TokenPair {
  const accessToken = jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  const jti = crypto.randomUUID();
  const family = options?.family ?? crypto.randomUUID();

  const refreshToken = jwt.sign(
    { ...payload, jti, family },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN },
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRES_IN,
  };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as RefreshTokenClaims;
  } catch {
    return null;
  }
}

/** Hash a token string for DB storage (SHA-256) */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Get refresh token expiry as a Date (for DB storage) */
export function getRefreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_EXPIRES_MS);
}
