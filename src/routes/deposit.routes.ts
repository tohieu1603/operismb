/**
 * Deposit Routes
 * Token deposit and payment endpoints
 */

import { Router } from "express";
import {
  getPricing,
  createDeposit,
  getDeposit,
  getPendingOrder,
  cancelPendingOrder,
  getDepositHistory,
  getTokenHistory,
  adminUpdateTokens,
  adminGetAllDeposits,
  sepayWebhook,
} from "../controllers/deposit.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware.js";

export const depositRoutes = Router();

// Public endpoints
depositRoutes.get("/pricing", getPricing);

// Webhook (no auth - uses signature verification)
depositRoutes.post("/webhook/sepay", sepayWebhook);

// Protected endpoints (require auth)
depositRoutes.use(authMiddleware);

// User deposit endpoints
depositRoutes.post("/", createDeposit);
depositRoutes.get("/pending", getPendingOrder); // Get current pending order
depositRoutes.delete("/:id", cancelPendingOrder); // Cancel pending order
depositRoutes.get("/history", getDepositHistory);
depositRoutes.get("/tokens/history", getTokenHistory);
depositRoutes.get("/:id", getDeposit);

// Admin endpoints
depositRoutes.get("/admin/all", adminMiddleware, adminGetAllDeposits);
depositRoutes.post("/admin/tokens", adminMiddleware, adminUpdateTokens);

export default depositRoutes;
