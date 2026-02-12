/**
 * Error Handling Middleware
 * Centralized error handling - follows SOLID principles
 */

import type { Request, Response, NextFunction } from "express";
import { ApiError, ErrorCode } from "../core/errors/api-error";

/**
 * Global error handler - converts all errors to generic responses
 * Security: Never expose internal error details to clients
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log detailed error for debugging
  console.error(`[api] Error [${err.name}]: ${err.message}`);
  if (err instanceof ApiError) {
    console.error(`  → Code: ${err.code} | Status: ${err.statusCode}`);
  }
  if (err.stack) {
    console.error(`  → Stack: ${err.stack.split("\n").slice(1, 4).join("\n")}`);
  }

  // Handle known API errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.publicMessage,
      code: err.code,
    });
    return;
  }

  // Handle validation errors (from validators)
  if (err.name === "ValidationError") {
    res.status(400).json({
      error: "Invalid request data",
      code: ErrorCode.VALIDATION_ERROR,
    });
    return;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    res.status(401).json({
      error: "Authentication failed",
      code: ErrorCode.INVALID_TOKEN,
    });
    return;
  }

  // Default: Generic error (never expose internal details)
  res.status(500).json({
    error: "An unexpected error occurred",
    code: ErrorCode.INTERNAL_ERROR,
  });
}

/**
 * Async route handler wrapper - catches async errors
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
