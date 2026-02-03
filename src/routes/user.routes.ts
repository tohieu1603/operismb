/**
 * User Routes (Admin)
 * Thin layer - delegates to controller
 */

import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index.js";

const router = Router();

// All routes require auth + admin
router.use(authMiddleware);
router.use(adminMiddleware);

router.get(
  "/",
  asyncHandler((req, res) => userController.list(req, res)),
);
router.get(
  "/:id",
  asyncHandler((req, res) => userController.getById(req, res)),
);
router.patch(
  "/:id",
  asyncHandler((req, res) => userController.update(req, res)),
);
router.delete(
  "/:id",
  asyncHandler((req, res) => userController.delete(req, res)),
);
router.post(
  "/:id/topup",
  asyncHandler((req, res) => userController.topup(req, res)),
);

export default router;
