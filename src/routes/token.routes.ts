/**
 * Token Routes
 * Thin layer - delegates to controller
 */

import { Router } from "express";
import { tokenController } from "../controllers/token.controller.js";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index.js";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// User routes
router.get(
  "/balance",
  asyncHandler((req, res) => tokenController.getBalance(req, res)),
);
router.get(
  "/transactions",
  asyncHandler((req, res) => tokenController.getTransactions(req, res)),
);

// Admin routes
router.get(
  "/admin/all",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.getAllTransactions(req, res)),
);
router.get(
  "/admin/user/:userId",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.getUserTransactions(req, res)),
);
router.post(
  "/admin/credit",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.credit(req, res)),
);
router.post(
  "/admin/debit",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.debit(req, res)),
);
router.post(
  "/admin/adjust",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.adjust(req, res)),
);

export default router;
