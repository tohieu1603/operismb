/**
 * Allow Hosts Middleware
 * Restricts API access to specific hosts/IPs
 */

import type { Request, Response, NextFunction } from "express";
import { MSG, LOG } from "../constants/messages";

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

  // Check if host/origin is in allowed list (exact match or suffix match to prevent bypass)
  const hostLower = host.toLowerCase().split(":")[0]; // strip port
  let originHost = "";
  try { if (origin) originHost = new URL(origin).hostname.toLowerCase(); } catch { /* invalid origin */ }
  const isAllowed = ALLOWED_HOSTS.some((allowed) => {
    return (
      hostLower === allowed ||
      hostLower.endsWith(`.${allowed}`) ||
      originHost === allowed ||
      originHost.endsWith(`.${allowed}`) ||
      clientIp === allowed
    );
  });

  if (isAllowed) {
    next();
    return;
  }

  // Reject
  console.warn(LOG.HOST_BLOCKED(clientIp, host, origin));
  res.status(403).json({
    error: MSG.ACCESS_DENIED,
    code: "FORBIDDEN",
  });
}

export default allowHostsMiddleware;
