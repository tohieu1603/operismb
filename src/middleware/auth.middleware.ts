/**
 * Authentication Middleware
 * JWT and API key authentication with role checking
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { verifyAccessToken, type TokenPayload } from "../utils/jwt.util";
import { userApiKeysRepo } from "../db/index";
import { Errors } from "../core/errors/api-error";

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
 * Requires valid Bearer token
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(Errors.unauthorized("Authentication required"));
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    next(Errors.invalidToken());
    return;
  }

  req.user = payload;
  next();
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
    next(Errors.unauthorized("Authentication required"));
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
 * Hybrid auth - accepts JWT or API key
 */
export async function hybridAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next(Errors.unauthorized("Authentication required"));
    return;
  }

  // Try JWT first
  if (authHeader.startsWith("Bearer ")) {
    authMiddleware(req, res, next);
    return;
  }

  // Try API key
  if (authHeader.startsWith("sk_")) {
    await apiKeyMiddleware(req, res, next);
    return;
  }

  next(Errors.unauthorized("Authentication required"));
}

/**
 * Optional JWT auth - parse token if present, skip if missing/invalid
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
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
