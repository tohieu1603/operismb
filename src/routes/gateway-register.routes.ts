/**
 * Gateway Register Routes
 * OpenClaw gateway calls this to register/update its connection info for a user
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/index.js";
import { updateUser, getUserByEmail } from "../db/models/users.js";

const REGISTER_SECRET = process.env.GATEWAY_REGISTER_SECRET || "operis-gateway-register-secret";

const router = Router();

/**
 * PUT /gateway/register
 * Called by OpenClaw gateway to update gateway_token + hooks_token for a user
 * Auth: Bearer <GATEWAY_REGISTER_SECRET>
 * Body: { email, gateway_url, gateway_token, hooks_token }
 */
router.put(
  "/register",
  asyncHandler(async (req, res) => {
    // Verify shared secret
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== REGISTER_SECRET) {
      res.status(401).json({ error: "Invalid register secret" });
      return;
    }

    const { email, gateway_url, gateway_token, hooks_token } = req.body ?? {};

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updates: Record<string, string | null> = {};
    if (gateway_token) updates.gateway_token = gateway_token;
    if (hooks_token) updates.gateway_hooks_token = hooks_token;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    await updateUser(user.id, updates);
    console.log(`[gateway-register] Updated gateway info for ${email}: ${Object.keys(updates).join(", ")}`);

    res.json({ ok: true, updated: Object.keys(updates) });
  }),
);

export default router;
