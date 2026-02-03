/**
 * Allow Hosts Middleware
 * Restricts API access to specific hosts/IPs
 */

import type { Request, Response, NextFunction } from "express";

// Read allowed hosts from environment
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || "localhost,127.0.0.1")
  .split(",")
  .map((h) => h.trim().toLowerCase());

/**
 * Check if request is from allowed host
 */
export function allowHostsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get client IP/host
  const clientIp = req.ip || req.socket.remoteAddress || "";
  const host = req.hostname || req.headers.host || "";
  const origin = req.headers.origin || "";

  // Always allow localhost
  const isLocalhost =
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp === "::ffff:127.0.0.1" ||
    host.includes("localhost") ||
    host.includes("127.0.0.1");

  if (isLocalhost) {
    next();
    return;
  }

  // Check if host/origin is in allowed list
  const isAllowed = ALLOWED_HOSTS.some((allowed) => {
    return (
      host.toLowerCase().includes(allowed) ||
      origin.toLowerCase().includes(allowed) ||
      clientIp.includes(allowed)
    );
  });

  if (isAllowed) {
    next();
    return;
  }

  // Reject
  console.warn(`[api] Blocked request from: ${clientIp} / ${host} / ${origin}`);
  res.status(403).json({
    error: "Access denied",
    code: "FORBIDDEN",
  });
}

export default allowHostsMiddleware;
