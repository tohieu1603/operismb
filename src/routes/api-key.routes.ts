/**
 * API Key Routes
 * Thin layer - delegates to controller
 */

import { Router } from "express";
import { apiKeyController } from "../controllers/api-key.controller.js";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index.js";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// User can manage their own keys
router.get(
  "/",
  asyncHandler((req, res) => apiKeyController.list(req, res)),
);
router.post(
  "/",
  asyncHandler((req, res) => apiKeyController.create(req, res)),
);
router.patch(
  "/:id",
  asyncHandler((req, res) => apiKeyController.update(req, res)),
);
router.delete(
  "/:id",
  asyncHandler((req, res) => apiKeyController.delete(req, res)),
);

// Admin routes
router.get(
  "/admin/all",
  adminMiddleware,
  asyncHandler((req, res) => apiKeyController.listAll(req, res)),
);
router.patch(
  "/admin/:id",
  adminMiddleware,
  asyncHandler((req, res) => apiKeyController.adminUpdate(req, res)),
);
router.delete(
  "/admin/:id",
  adminMiddleware,
  asyncHandler((req, res) => apiKeyController.adminDelete(req, res)),
);

export default router;
