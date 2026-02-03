/**
 * Auth Routes
 * Thin layer - delegates to controller
 */

import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authMiddleware, asyncHandler } from "../middleware/index.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { validateRegister, validateLogin, validateRefresh } from "../validators/auth.validator.js";

const router = Router();

// Public routes
router.post(
  "/register",
  validateBody(validateRegister),
  asyncHandler((req, res) => authController.register(req, res)),
);
router.post(
  "/login",
  validateBody(validateLogin),
  asyncHandler((req, res) => authController.login(req, res)),
);
router.post(
  "/refresh",
  validateBody(validateRefresh),
  asyncHandler((req, res) => authController.refresh(req, res)),
);
router.post("/logout", (req, res) => authController.logout(req, res));

// Protected routes
router.get(
  "/me",
  authMiddleware,
  asyncHandler((req, res) => authController.getMe(req, res)),
);

export default router;
