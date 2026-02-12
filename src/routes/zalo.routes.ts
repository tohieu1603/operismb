/**
 * Zalo Routes
 * QR login, channel management, and OpenClaw webhook endpoints
 */

import { Router } from "express";
import { zaloController } from "../controllers/zalo.controller";
import { authMiddleware, asyncHandler, openclawWebhookMiddleware } from "../middleware/index";

const router = Router();

// ============================================================================
// User-facing endpoints (requires JWT auth)
// ============================================================================

// POST /api/zalo/connect — start QR login
router.post("/connect", authMiddleware, asyncHandler((req, res) => zaloController.connect(req, res)));

// GET /api/zalo/status?token=... — poll QR status
router.get("/status", authMiddleware, asyncHandler((req, res) => zaloController.status(req, res)));

// GET /api/zalo/channel — get connection info
router.get("/channel", authMiddleware, asyncHandler((req, res) => zaloController.channel(req, res)));

// GET /api/zalo/channels — list all channels
router.get("/channels", authMiddleware, asyncHandler((req, res) => zaloController.channels(req, res)));

// POST /api/zalo/disconnect — disconnect
router.post("/disconnect", authMiddleware, asyncHandler((req, res) => zaloController.disconnect(req, res)));

// ============================================================================
// OpenClaw webhook endpoints (requires OPENCLAW_WEBHOOK_KEY)
// ============================================================================

// POST /api/zalo/webhook/token-usage — record token usage + debit balance
router.post("/webhook/token-usage", openclawWebhookMiddleware, asyncHandler((req, res) => zaloController.webhookTokenUsage(req, res)));

// GET /api/zalo/webhook/balance-check?user_id=...&required=...
router.get("/webhook/balance-check", openclawWebhookMiddleware, asyncHandler((req, res) => zaloController.webhookBalanceCheck(req, res)));

export default router;
