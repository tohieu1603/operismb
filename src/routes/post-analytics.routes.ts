/**
 * Post Analytics Routes
 * Endpoints for post analytics tracking and reporting
 */

import { Router } from "express";
import { postAnalyticsController } from "../controllers/post-analytics.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// Public: record analytics event (called from frontend)
router.post("/events", asyncHandler((req, res) => postAnalyticsController.recordEvent(req, res)));

// Admin-only read endpoints
router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/overview", asyncHandler((req, res) => postAnalyticsController.getOverview(req, res)));
router.get("/events", asyncHandler((req, res) => postAnalyticsController.listEvents(req, res)));
router.get("/post/:postId", asyncHandler((req, res) => postAnalyticsController.getPostAnalytics(req, res)));
router.get("/daily/:entityType/:entityId", asyncHandler((req, res) => postAnalyticsController.getDailyStats(req, res)));

export default router;
