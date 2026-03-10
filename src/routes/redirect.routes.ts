/**
 * Redirect Routes
 * CRUD endpoints for redirect management
 */

import { Router } from "express";
import { redirectController } from "../controllers/redirect.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public: get active redirects (used by middleware)
router.get("/active", asyncHandler((req, res) => {
  const { listRedirects } = require("../db/models/redirects");
  return listRedirects({ isActive: true }).then((data: unknown) => res.json(data));
}));

// Admin-only management
router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/", asyncHandler((req, res) => redirectController.list(req, res)));
router.get("/:id", asyncHandler((req, res) => redirectController.getById(req, res)));
router.post("/", asyncHandler((req, res) => redirectController.create(req, res)));
router.put("/:id", asyncHandler((req, res) => redirectController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => redirectController.update(req, res)));
router.patch("/:id/toggle-active", asyncHandler((req, res) => redirectController.toggleActive(req, res)));
router.delete("/:id", asyncHandler((req, res) => redirectController.delete(req, res)));

export default router;
