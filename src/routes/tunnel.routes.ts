/**
 * Tunnel Routes
 * Auto-provision/deprovision Cloudflare tunnels for desktop app users
 *
 * - POST /provision   — Create tunnel + DNS + return token (JWT required)
 * - DELETE /deprovision — Remove tunnel + DNS (JWT required)
 * - GET /status       — Get tunnel info (JWT required)
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  provisionTunnel,
  deprovisionTunnel,
  getTunnelStatus,
} from "../services/cloudflare-tunnel.service.js";

const router = Router();

// All endpoints require JWT login
router.use(authMiddleware);

/**
 * POST /provision — Auto-provision a Cloudflare tunnel for the authenticated user.
 * Idempotent: returns existing tunnel if already provisioned.
 */
router.post("/provision", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const email = req.user!.email;

    const result = await provisionTunnel(userId, email);

    res.json({
      tunnelId: result.tunnelId,
      tunnelToken: result.tunnelToken,
      domain: result.domain,
      tunnelName: result.tunnelName,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /deprovision — Remove the user's tunnel and DNS record.
 */
router.delete("/deprovision", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    await deprovisionTunnel(userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /status — Get current tunnel info for the authenticated user.
 */
router.get("/status", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const status = await getTunnelStatus(userId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

export const tunnelRoutes = router;
export default router;
