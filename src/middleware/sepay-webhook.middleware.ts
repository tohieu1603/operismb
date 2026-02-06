/**
 * SePay Webhook Verification Middleware
 * Validates API key from Authorization header against SEPAY_WEBHOOK_API_KEY env var.
 * Always returns HTTP 200 per SePay requirement — rejected requests are logged but not retried.
 */

import type { Request, Response, NextFunction } from "express";

const SEPAY_WEBHOOK_API_KEY = process.env.SEPAY_WEBHOOK_API_KEY || "";

/**
 * Verify SePay webhook API key.
 * If key mismatch → log warning, respond 200 with success:true (SePay never retries).
 * If no SEPAY_WEBHOOK_API_KEY configured → skip verification (dev mode).
 */
export function sepayWebhookMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip verification if no API key configured (dev/test)
  if (!SEPAY_WEBHOOK_API_KEY) {
    console.warn("[sepay-webhook] No SEPAY_WEBHOOK_API_KEY configured — skipping verification");
    next();
    return;
  }

  const authHeader = req.headers.authorization || "";
  // SePay sends: "Apikey <key>" or just the raw key
  const providedKey = authHeader.startsWith("Apikey ")
    ? authHeader.slice(7)
    : authHeader;

  if (providedKey !== SEPAY_WEBHOOK_API_KEY) {
    console.warn(
      `[sepay-webhook] Rejected: invalid API key from ${req.ip} | header: "${authHeader.slice(0, 20)}..."`,
    );
    // Always return 200 to prevent SePay retries
    res.status(200).json({ success: true });
    return;
  }

  next();
}

export default sepayWebhookMiddleware;
