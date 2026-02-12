/**
 * Zalo Controller
 * Handles HTTP requests for Zalo QR login, channel management, and OpenClaw webhooks
 */

import type { Request, Response } from "express";
import { zaloService } from "../services/zalo.service";

class ZaloController {
  /** POST /zalo/connect — start QR login */
  async connect(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const result = zaloService.startLogin(userId);
    res.json(result);
  }

  /** GET /zalo/status?token=... — poll QR/login status */
  async status(req: Request, res: Response): Promise<void> {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).json({ error: "Missing token parameter" });
      return;
    }
    const result = zaloService.getStatus(token);
    if (!result) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }
    res.json(result);
  }

  /** GET /zalo/channel — get connection info */
  async channel(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const result = await zaloService.getChannel(userId);
    res.json(result);
  }

  /** GET /zalo/channels — list all channels */
  async channels(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const result = await zaloService.listChannels(userId);
    res.json({ channels: result });
  }

  /** POST /zalo/disconnect — disconnect channel */
  async disconnect(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const accountLabel = (req.body.accountLabel as string) || "default";
    const result = await zaloService.disconnect(userId, accountLabel);
    res.json(result);
  }

  // =========================================================================
  // OpenClaw Webhook Endpoints (authenticated via OPENCLAW_WEBHOOK_KEY)
  // =========================================================================

  /** POST /zalo/webhook/token-usage — record token usage + debit balance */
  async webhookTokenUsage(req: Request, res: Response): Promise<void> {
    const {
      user_id,
      input_tokens,
      output_tokens,
      model,
      request_type,
      request_id,
      metadata,
    } = req.body;

    if (!user_id || input_tokens == null || output_tokens == null) {
      res.status(400).json({ error: "Missing required fields: user_id, input_tokens, output_tokens" });
      return;
    }

    const result = await zaloService.recordTokenUsage({
      userId: user_id,
      inputTokens: Number(input_tokens),
      outputTokens: Number(output_tokens),
      model,
      requestType: request_type,
      requestId: request_id,
      metadata,
    });

    res.json({
      success: true,
      usage_id: result.usage.id,
      total_tokens: result.usage.total_tokens,
      balance_after: result.balanceAfter,
    });
  }

  /** GET /zalo/webhook/balance-check?user_id=...&required=... — check token balance */
  async webhookBalanceCheck(req: Request, res: Response): Promise<void> {
    const userId = req.query.user_id as string;
    const required = parseInt(req.query.required as string) || 0;

    if (!userId) {
      res.status(400).json({ error: "Missing user_id parameter" });
      return;
    }

    const result = await zaloService.checkBalance(userId, required);
    res.json(result);
  }
}

export const zaloController = new ZaloController();
