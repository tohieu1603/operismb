/**
 * Token Controller
 * Handles HTTP requests for token balance and transactions
 */

import type { Request, Response } from "express";
import { tokenService } from "../services/token.service.js";

class TokenController {
  async getBalance(req: Request, res: Response): Promise<void> {
    const balance = await tokenService.getBalance(req.user!.userId);
    res.json({ balance });
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string | undefined;

    const result = await tokenService.getTransactions(req.user!.userId, page, limit, type);
    res.json({
      transactions: result.transactions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  // Admin: Get user's transactions
  async getUserTransactions(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string | undefined;

    const result = await tokenService.getTransactions(userId, page, limit, type);
    res.json({
      transactions: result.transactions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  async credit(req: Request, res: Response): Promise<void> {
    const { userId, amount, description } = req.body;
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required and must be a string", code: "VALIDATION_ERROR" });
      return;
    }
    if (typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
      res.status(400).json({ error: "amount must be a positive number", code: "VALIDATION_ERROR" });
      return;
    }
    const result = await tokenService.credit(userId, amount, description || "Admin credit");
    res.json(result);
  }

  async debit(req: Request, res: Response): Promise<void> {
    const { userId, amount, description } = req.body;
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required and must be a string", code: "VALIDATION_ERROR" });
      return;
    }
    if (typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
      res.status(400).json({ error: "amount must be a positive number", code: "VALIDATION_ERROR" });
      return;
    }
    const result = await tokenService.debit(userId, amount, description || "Admin debit");
    res.json(result);
  }

  async adjust(req: Request, res: Response): Promise<void> {
    const { userId, amount, description } = req.body;
    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required and must be a string", code: "VALIDATION_ERROR" });
      return;
    }
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      res.status(400).json({ error: "amount must be a finite number", code: "VALIDATION_ERROR" });
      return;
    }
    const result = await tokenService.adjust(userId, amount, description || "Admin adjustment");
    res.json(result);
  }

  /** POST /tokens/usage - Deduct tokens after AI chat */
  async deductUsage(req: Request, res: Response): Promise<void> {
    const { prompt_tokens, completion_tokens, total_tokens, model, request_type, request_id, metadata } = req.body;

    if (!total_tokens || total_tokens <= 0) {
      res.status(400).json({ error: "total_tokens is required and must be > 0" });
      return;
    }

    const result = await tokenService.deductUsage(req.user!.userId, {
      prompt_tokens: prompt_tokens ?? 0,
      completion_tokens: completion_tokens ?? 0,
      total_tokens,
      model,
      request_type,
      request_id,
      metadata,
    });

    res.json(result);
  }

  // Admin: Get all transactions across all users
  async getAllTransactions(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string | undefined;
    const userId = req.query.userId as string | undefined;

    const result = await tokenService.getAllTransactions(page, limit, type, userId);
    res.json({
      transactions: result.transactions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }
}

export const tokenController = new TokenController();
