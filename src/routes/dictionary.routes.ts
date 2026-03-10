/**
 * Dictionary Routes
 * CRUD endpoints for dictionary/glossary management
 */

import { Router } from "express";
import { dictionaryController } from "../controllers/dictionary.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public read endpoints
router.get("/alphabet", asyncHandler((req, res) => dictionaryController.getAlphabetIndex(req, res)));
router.get("/featured", asyncHandler((req, res) => dictionaryController.getFeatured(req, res)));
router.get("/popular", asyncHandler((req, res) => dictionaryController.getPopular(req, res)));
router.get("/recent", asyncHandler((req, res) => dictionaryController.getRecent(req, res)));
router.get("/suggestions", asyncHandler((req, res) => dictionaryController.getSuggestions(req, res)));
router.get("/letter/:letter", asyncHandler((req, res) => dictionaryController.getByLetter(req, res)));
router.get("/category/:categoryId", asyncHandler((req, res) => dictionaryController.getByCategory(req, res)));
router.get("/slug/:slug", asyncHandler((req, res) => dictionaryController.getBySlug(req, res)));
router.get("/", asyncHandler((req, res) => dictionaryController.list(req, res)));
router.get("/:id", asyncHandler((req, res) => dictionaryController.getById(req, res)));

// Public view tracking
router.post("/:id/view", asyncHandler((req, res) => dictionaryController.trackView(req, res)));

// Admin-only write operations
router.use(authMiddleware);
router.use(adminMiddleware);

router.post("/bulk-import", asyncHandler((req, res) => dictionaryController.bulkImport(req, res)));
router.post("/", asyncHandler((req, res) => dictionaryController.create(req, res)));
router.put("/:id", asyncHandler((req, res) => dictionaryController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => dictionaryController.update(req, res)));
router.patch("/:id/toggle-active", asyncHandler((req, res) => dictionaryController.toggleActive(req, res)));
router.patch("/:id/toggle-featured", asyncHandler((req, res) => dictionaryController.toggleFeatured(req, res)));
router.delete("/:id", asyncHandler((req, res) => dictionaryController.delete(req, res)));

export default router;
