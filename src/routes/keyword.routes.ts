/**
 * Keyword Routes
 * CRUD endpoints for keyword tracking management
 */

import { Router } from "express";
import { keywordController } from "../controllers/keyword.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// All keyword routes require admin auth
router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/post/:postId", asyncHandler((req, res) => keywordController.getByPost(req, res)));
router.get("/", asyncHandler((req, res) => keywordController.list(req, res)));
router.get("/:id", asyncHandler((req, res) => keywordController.getById(req, res)));
router.post("/bulk", asyncHandler((req, res) => keywordController.bulkCreate(req, res)));
router.post("/", asyncHandler((req, res) => keywordController.create(req, res)));
router.put("/:id", asyncHandler((req, res) => keywordController.update(req, res)));
router.patch("/:id", asyncHandler((req, res) => keywordController.update(req, res)));
router.delete("/:id", asyncHandler((req, res) => keywordController.delete(req, res)));

export default router;
