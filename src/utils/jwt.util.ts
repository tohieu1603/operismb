/**
 * JWT utilities
 */

import jwt from "jsonwebtoken";

// Secret keys (should be in env)
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "operis-access-secret-change-in-production";
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "operis-refresh-secret-change-in-production";

// Token expiration
const ACCESS_EXPIRES_IN = "1h";
const REFRESH_EXPIRES_IN = "7d";

export interface TokenPayload {
  userId: string;
  email: string;
  role: "admin" | "user";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export function generateTokens(payload: TokenPayload): TokenPair {
  const accessToken = jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });

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

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
