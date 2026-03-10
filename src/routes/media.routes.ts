/**
 * Media Routes
 * CRUD endpoints for media management
 */

import { Router } from "express";
import { mediaController } from "../controllers/media.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Public read endpoints
router.get("/folders", asyncHandler((req, res) => mediaController.getFolders(req, res)));
router.get("/by-section", asyncHandler((req, res) => mediaController.getBySection(req, res)));
router.get("/", asyncHandler((req, res) => mediaController.list(req, res)));
router.get("/:id", asyncHandler((req, res) => mediaController.getById(req, res)));
router.get("/:id/usage", asyncHandler((req, res) => mediaController.getUsage(req, res)));

// Admin-only write operations
router.use(authMiddleware);
router.use(adminMiddleware);

router.post(
  "/upload",
  upload.single("file"),
  asyncHandler((req, res) => mediaController.upload(req, res))
);
router.post(
  "/",
  upload.single("file"),
  asyncHandler((req, res) => mediaController.upload(req, res))
);
router.put("/:id", asyncHandler((req, res) => mediaController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => mediaController.update(req, res)));
router.patch("/:id/assign", asyncHandler((req, res) => mediaController.assignToSection(req, res)));
router.patch("/:id/unassign", asyncHandler((req, res) => mediaController.unassignFromSection(req, res)));
router.delete("/:id", asyncHandler((req, res) => mediaController.delete(req, res)));

export default router;
