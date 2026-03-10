/**
 * Post Author Routes
 * CRUD endpoints for author management
 */

import { Router } from "express";
import { postAuthorController } from "../controllers/post-author.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public read endpoints
router.get("/dropdown", asyncHandler((req, res) => postAuthorController.getDropdown(req, res)));
router.get("/featured", asyncHandler((req, res) => postAuthorController.getFeatured(req, res)));
router.get("/slug/:slug", asyncHandler((req, res) => postAuthorController.getBySlug(req, res)));
router.get("/", asyncHandler((req, res) => postAuthorController.list(req, res)));
router.get("/:id", asyncHandler((req, res) => postAuthorController.getById(req, res)));

// Admin-only write operations
router.use(authMiddleware);
router.use(adminMiddleware);

router.post("/generate-slug", asyncHandler((req, res) => postAuthorController.generateSlug(req, res)));
router.post("/", asyncHandler((req, res) => postAuthorController.create(req, res)));
router.put("/sort-order", asyncHandler((req, res) => postAuthorController.updateSortOrder(req, res)));
router.put("/:id", asyncHandler((req, res) => postAuthorController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => postAuthorController.update(req, res)));
router.patch("/:id/toggle-active", asyncHandler((req, res) => postAuthorController.toggleActive(req, res)));
router.patch("/:id/toggle-featured", asyncHandler((req, res) => postAuthorController.toggleFeatured(req, res)));
router.delete("/:id", asyncHandler((req, res) => postAuthorController.delete(req, res)));

export default router;
