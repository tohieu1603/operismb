/**
 * OpenClaw Webhook Verification Middleware
 * Validates API key from Authorization header against OPENCLAW_WEBHOOK_KEY env var.
 * Used for token-usage reporting and balance-check endpoints.
 */

import type { Request, Response, NextFunction } from "express";

const OPENCLAW_WEBHOOK_KEY = process.env.OPENCLAW_WEBHOOK_KEY || "";

/**
 * Verify OpenClaw webhook API key.
 * Expects: Authorization: Bearer <key>
 * If no OPENCLAW_WEBHOOK_KEY configured → skip verification (dev mode).
 */
export function openclawWebhookMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip verification if no key configured (dev/test)
  if (!OPENCLAW_WEBHOOK_KEY) {
    next();
    return;
  }

  const authHeader = req.headers.authorization || "";
  const providedKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (providedKey !== OPENCLAW_WEBHOOK_KEY) {
    res.status(401).json({ error: "Invalid webhook key" });
    return;
  }

  next();
}

export default openclawWebhookMiddleware;
