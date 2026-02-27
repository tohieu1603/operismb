/**
 * Authentication Middleware
 * JWT and API key authentication with role checking
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { verifyAccessToken, type TokenPayload } from "../utils/jwt.util";
import { userApiKeysRepo } from "../db/index";
import { Errors } from "../core/errors/api-error";
import { MSG } from "../constants/messages";
import { ACCESS_COOKIE } from "../utils/cookie.util";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      apiKeyId?: string;
    }
  }
}

/**
 * JWT authentication middleware
 * Tries HttpOnly cookie first, then falls back to Bearer header
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // 1. Try HttpOnly cookie
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  if (cookieToken) {
    const payload = verifyAccessToken(cookieToken);
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }

  // 2. Fall back to Authorization: Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }

  next(Errors.unauthorized(MSG.AUTH_REQUIRED));
}

/**
 * API key authentication middleware
 * Requires valid sk_* key in Authorization header
 */
export async function apiKeyMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("sk_")) {
    next(Errors.unauthorized(MSG.AUTH_REQUIRED));
    return;
  }

  const keyHash = crypto.createHash("sha256").update(authHeader).digest("hex");
  const key = await userApiKeysRepo.getApiKeyByHash(keyHash);

  if (!key) {
    next(Errors.invalidToken());
    return;
  }

  if (!key.is_active) {
    next(Errors.invalidToken());
    return;
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    next(Errors.invalidToken());
    return;
  }

  // Update last used
  await userApiKeysRepo.updateLastUsed(key.id);

  req.user = { userId: key.user_id, email: "", role: "user" };
  req.apiKeyId = key.id;
  next();
}

/**
 * Hybrid auth - accepts cookie, JWT Bearer, or API key
 */
export async function hybridAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 1. Try HttpOnly cookie
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  if (cookieToken) {
    const payload = verifyAccessToken(cookieToken);
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }

  const authHeader = req.headers.authorization;

  // 2. Try JWT Bearer header
  if (authHeader?.startsWith("Bearer ")) {
    authMiddleware(req, res, next);
    return;
  }

  // 3. Try API key
  if (authHeader?.startsWith("sk_")) {
    await apiKeyMiddleware(req, res, next);
    return;
  }

  // No valid auth source found
  if (!authHeader && !cookieToken) {
    next(Errors.unauthorized(MSG.AUTH_REQUIRED));
    return;
  }

  next(Errors.unauthorized(MSG.AUTH_REQUIRED));
}

/**
 * Optional JWT auth - parse cookie or Bearer token if present, skip if missing/invalid
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Try cookie first
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  if (cookieToken) {
    const payload = verifyAccessToken(cookieToken);
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }
  // Fall back to Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) req.user = payload;
  }
  next();
}

/**
 * Role check middleware factory
 * Usage: router.use(requireRole('admin'))
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(Errors.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(Errors.forbidden());
      return;
    }

    next();
  };
}

/**
 * Shorthand for admin role
 */
export const adminMiddleware = requireRole("admin");
