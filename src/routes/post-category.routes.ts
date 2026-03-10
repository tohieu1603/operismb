/**
 * Post Category Routes
 * CRUD endpoints for category management
 */

import { Router } from "express";
import { postCategoryController } from "../controllers/post-category.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public read endpoints
router.get("/tree", asyncHandler((req, res) => postCategoryController.getTree(req, res)));
router.get("/slug/:slug", asyncHandler((req, res) => postCategoryController.getBySlug(req, res)));
router.get("/", asyncHandler((req, res) => postCategoryController.list(req, res)));
router.get("/:id", asyncHandler((req, res) => postCategoryController.getById(req, res)));

// Admin-only write operations
router.use(authMiddleware);
router.use(adminMiddleware);

router.post("/generate-slug", asyncHandler((req, res) => postCategoryController.generateSlug(req, res)));
router.post("/", asyncHandler((req, res) => postCategoryController.create(req, res)));
router.put("/:id", asyncHandler((req, res) => postCategoryController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => postCategoryController.update(req, res)));
router.patch("/:id/toggle-active", asyncHandler((req, res) => postCategoryController.toggleActive(req, res)));
router.delete("/:id", asyncHandler((req, res) => postCategoryController.delete(req, res)));

export default router;
