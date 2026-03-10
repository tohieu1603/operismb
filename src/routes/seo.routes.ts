/**
 * SEO Routes
 * Endpoints for SEO scores and logs management
 */

import { Router } from "express";
import { seoController } from "../controllers/seo.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// All SEO management routes require admin auth
router.use(authMiddleware);
router.use(adminMiddleware);

// SEO Scores
router.get("/scores", asyncHandler((req, res) => seoController.listScores(req, res)));
router.get("/scores/:id", asyncHandler((req, res) => seoController.getScoreById(req, res)));
router.get("/scores/post/:postId", asyncHandler((req, res) => seoController.getScoreByPost(req, res)));
router.get("/scores/post/:postId/history", asyncHandler((req, res) => seoController.getScoreHistoryByPost(req, res)));
router.post("/scores", asyncHandler((req, res) => seoController.createScore(req, res)));
router.delete("/scores/:id", asyncHandler((req, res) => seoController.deleteScore(req, res)));

// SEO Logs
router.get("/logs", asyncHandler((req, res) => seoController.listLogs(req, res)));
router.get("/logs/:id", asyncHandler((req, res) => seoController.getLogById(req, res)));
router.get("/logs/entity/:entityType/:entityId", asyncHandler((req, res) => seoController.getLogsByEntity(req, res)));
router.post("/logs", asyncHandler((req, res) => seoController.createLog(req, res)));
router.delete("/logs/:id", asyncHandler((req, res) => seoController.deleteLog(req, res)));
router.delete("/logs/prune", asyncHandler((req, res) => seoController.pruneLogs(req, res)));

export default router;
