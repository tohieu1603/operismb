/**
 * Post Routes
 * CRUD endpoints for post management
 * - Admin: full access (all statuses)
 * - Public: only published posts
 */

import { Router } from "express";
import { postController } from "../controllers/post.controller";
import { authMiddleware, adminMiddleware, optionalAuthMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public read endpoints (these already filter by published status in repo)
router.get("/recent", asyncHandler((req, res) => postController.getRecent(req, res)));
router.get("/category/:categoryId", asyncHandler((req, res) => postController.getByCategory(req, res)));
router.get("/category-slug/:slug", asyncHandler((req, res) => postController.getByCategorySlug(req, res)));

// These endpoints use optionalAuth to distinguish admin (sees all) vs public (published only)
router.get("/slug/:slug", optionalAuthMiddleware, asyncHandler((req, res) => postController.getBySlug(req, res)));
router.get("/", optionalAuthMiddleware, asyncHandler((req, res) => postController.list(req, res)));
router.get("/:id", optionalAuthMiddleware, asyncHandler((req, res) => postController.getById(req, res)));

// Increment view count (public, only for published posts)
router.post("/:id/view", asyncHandler((req, res) => postController.incrementViewCount(req, res)));

// Admin-only endpoints
router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/statistics", asyncHandler((req, res) => postController.getStatistics(req, res)));
router.post("/generate-slug", asyncHandler((req, res) => postController.generateSlug(req, res)));
router.post("/", asyncHandler((req, res) => postController.create(req, res)));
router.put("/:id", asyncHandler((req, res) => postController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => postController.update(req, res)));
router.patch("/:id/status", asyncHandler((req, res) => postController.updateStatus(req, res)));
router.delete("/:id", asyncHandler((req, res) => postController.delete(req, res)));

export default router;
