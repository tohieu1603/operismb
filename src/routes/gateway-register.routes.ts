/**
 * Gateway Register Routes
 * OpenClaw gateway calls this to register/update its connection info for a user
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/index";
import { updateUser, getUserByEmail } from "../db/models/users";
import { MSG } from "../constants/messages";

const REGISTER_SECRET = process.env.GATEWAY_REGISTER_SECRET;
if (!REGISTER_SECRET) {
  console.error("[FATAL] GATEWAY_REGISTER_SECRET env var is not set — gateway register route disabled");
}

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
    // Verify shared secret (reject all if not configured)
    const authHeader = req.headers.authorization;
    if (!REGISTER_SECRET || !authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== REGISTER_SECRET) {
      res.status(401).json({ error: MSG.INVALID_REGISTER_SECRET });
      return;
    }

    const { email, gateway_url, gateway_token, hooks_token } = req.body ?? {};

    if (!email) {
      res.status(400).json({ error: MSG.REGISTER_EMAIL_REQUIRED });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: MSG.USER_NOT_FOUND });
      return;
    }

    const updates: Record<string, string | null> = {};
    if (gateway_token) updates.gateway_token = gateway_token;
    if (hooks_token) updates.gateway_hooks_token = hooks_token;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: MSG.NO_FIELDS_TO_UPDATE });
      return;
    }

    await updateUser(user.id, updates);
    console.log(`[gateway-register] Updated gateway info for ${email}: ${Object.keys(updates).join(", ")}`);

    res.json({ ok: true, updated: Object.keys(updates) });
  }),
);

export default router;
