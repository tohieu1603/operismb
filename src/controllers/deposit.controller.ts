/**
 * Deposit Controller - Handle deposit/topup requests
 */

import type { Request, Response, NextFunction } from "express";
import { depositService } from "../services/deposit.service.js";

/**
 * Get pricing info
 */
export async function getPricing(_req: Request, res: Response, next: NextFunction) {
  try {
    const pricing = depositService.getPricingInfo();
    res.json(pricing);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new deposit order
 */
export async function createDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { tokenAmount } = req.body;

    const order = await depositService.createDeposit(userId, { tokenAmount });
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

/**
 * Get deposit order by ID
 */
export async function getDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const order = await depositService.getDeposit(userId, id);
    res.json(order);
  } catch (error) {
    next(error);
  }
}

/**
 * Get current pending order (for retry payment)
 */
export async function getPendingOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const order = await depositService.getPendingOrder(userId);

    if (!order) {
      res.json({ hasPending: false, order: null });
    } else {
      res.json({ hasPending: true, order });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel pending order (allows creating new one)
 */
export async function cancelPendingOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const result = await depositService.cancelPendingOrder(userId, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's deposit history
 */
export async function getDepositHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(String(req.query.limit ?? "20"), 10);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);

    const result = await depositService.getDepositHistory(userId, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's token transaction history
 */
export async function getTokenHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(String(req.query.limit ?? "50"), 10);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);

    const result = await depositService.getTokenHistory(userId, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get all deposits across all users
 */
export async function adminGetAllDeposits(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10), 100);
    const status = req.query.status as string | undefined;
    const userId = req.query.userId as string | undefined;

    const result = await depositService.getAllDeposits(page, limit, status, userId);
    res.json({
      deposits: result.deposits,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Update user tokens
 */
export async function adminUpdateTokens(req: Request, res: Response, next: NextFunction) {
  try {
    const adminUserId = req.user!.userId;
    const { userId, amount, reason } = req.body;

    const result = await depositService.adminUpdateTokens(adminUserId, userId, amount, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * SePay webhook callback.
 * ALWAYS returns HTTP 200 to prevent SePay retries.
 * Errors are logged internally but never surfaced.
 */
export async function sepayWebhook(req: Request, res: Response, _next: NextFunction) {
  try {
    const data = req.body;

    await depositService.processPaymentWebhook({
      transferType: data.transferType,
      transferAmount: data.transferAmount,
      content: data.content,
      referenceCode: data.referenceCode,
      transactionDate: data.transactionDate,
    });
  } catch (error) {
    console.error("[sepay-webhook] Processing error:", error);
  }

  // Always return 200 — SePay requirement
  res.status(200).json({ success: true });
}
