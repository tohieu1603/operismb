/**
 * Post Tag Routes
 * CRUD endpoints for tag management
 */

import { Router } from "express";
import { postTagController } from "../controllers/post-tag.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public read endpoints
router.get("/slug/:slug", asyncHandler((req, res) => postTagController.getBySlug(req, res)));
router.get("/", asyncHandler((req, res) => postTagController.list(req, res)));
router.get("/:id", asyncHandler((req, res) => postTagController.getById(req, res)));

// Admin-only write operations
router.use(authMiddleware);
router.use(adminMiddleware);

router.post("/generate-slug", asyncHandler((req, res) => postTagController.generateSlug(req, res)));
router.post("/", asyncHandler((req, res) => postTagController.create(req, res)));
router.put("/:id", asyncHandler((req, res) => postTagController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => postTagController.update(req, res)));
router.patch("/:id/toggle-active", asyncHandler((req, res) => postTagController.toggleActive(req, res)));
router.delete("/:id", asyncHandler((req, res) => postTagController.delete(req, res)));

export default router;
