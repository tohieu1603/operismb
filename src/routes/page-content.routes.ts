/**
 * Page Content Routes
 * CRUD endpoints for page content management
 */

import { Router } from "express";
import { pageContentController } from "../controllers/page-content.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public read endpoint
router.get("/:pageSlug", asyncHandler((req, res) => pageContentController.getBySlug(req, res)));
router.get("/", asyncHandler((req, res) => pageContentController.list(req, res)));

// Admin-only write operations
router.use(authMiddleware);
router.use(adminMiddleware);

router.post("/import", asyncHandler((req, res) => pageContentController.importFromJson(req, res)));
router.post("/", asyncHandler((req, res) => pageContentController.create(req, res)));
router.put("/:pageSlug/upsert", asyncHandler((req, res) => pageContentController.upsert(req, res)));
router.put("/:pageSlug", asyncHandler((req, res) => pageContentController.update(req, res)));
router.patch("/:pageSlug/toggle-active", asyncHandler((req, res) => pageContentController.toggleActive(req, res)));
router.delete("/:pageSlug", asyncHandler((req, res) => pageContentController.delete(req, res)));

export default router;
