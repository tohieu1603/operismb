/**
 * Feedback Routes
 * ===============
 * Báo cáo lỗi và phản hồi khách hàng
 */

import { Router } from "express";
import {
  createReport,
  getMyReports,
  getAllReports,
  updateReportStatus,
} from "../controllers/feedback.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

// User routes
router.post("/", authMiddleware, asyncHandler(createReport));
router.get("/", authMiddleware, asyncHandler(getMyReports));

// Admin routes
router.get("/all", authMiddleware, adminMiddleware, asyncHandler(getAllReports));
router.patch("/:id/status", authMiddleware, adminMiddleware, asyncHandler(updateReportStatus));

export default router;
