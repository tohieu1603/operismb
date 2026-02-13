/**
 * Analytics Routes
 * Token usage analytics and statistics endpoints
 */

import { Router } from "express";
import {
  getUserUsage,
  getUserDaily,
  getUserRange,
  getUserHistory,
  getAdminOverview,
  getAdminDaily,
  getAdminRange,
  getAdminUserStats,
  getAdminHistory,
} from "../controllers/analytics.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

export const analyticsRoutes = Router();

// All analytics endpoints require authentication
analyticsRoutes.use(authMiddleware);

// =============================================================================
// USER ANALYTICS ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /analytics/usage:
 *   get:
 *     tags: [Analytics]
 *     summary: Thống kê token usage
 *     description: |
 *       Lấy thống kê token usage của user hiện tại.
 *
 *       **Period:**
 *       - `today`: Hôm nay (so sánh với hôm qua)
 *       - `week`: Tuần này (so sánh với tuần trước)
 *       - `month`: Tháng này (so sánh với tháng trước)
 *       - `year`: Năm này (so sánh với năm trước)
 *
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: today
 *         description: Khoảng thời gian thống kê
 *
 *     responses:
 *       200:
 *         description: Thống kê usage
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                 current:
 *                   $ref: '#/components/schemas/TokenUsageStats'
 *                 previous:
 *                   $ref: '#/components/schemas/TokenUsageStats'
 *                 byType:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenUsageByType'
 *                 daily:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenUsageByDate'
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/usage", asyncHandler(getUserUsage));

/**
 * @swagger
 * /analytics/usage/daily:
 *   get:
 *     tags: [Analytics]
 *     summary: Thống kê theo ngày
 *     description: Lấy thống kê token usage theo ngày.
 *
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 90
 *           default: 7
 *         description: Số ngày gần nhất
 *
 *     responses:
 *       200:
 *         description: Thống kê theo ngày
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/usage/daily", asyncHandler(getUserDaily));

/**
 * @swagger
 * /analytics/usage/range:
 *   get:
 *     tags: [Analytics]
 *     summary: Thống kê theo khoảng thời gian
 *     description: Lấy thống kê token usage theo khoảng thời gian tùy chỉnh.
 *
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày bắt đầu (YYYY-MM-DD)
 *
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày kết thúc (YYYY-MM-DD)
 *
 *     responses:
 *       200:
 *         description: Thống kê theo khoảng thời gian
 *
 *       400:
 *         description: Thiếu tham số start hoặc end
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/usage/range", asyncHandler(getUserRange));

/**
 * @swagger
 * /analytics/usage/history:
 *   get:
 *     tags: [Analytics]
 *     summary: Lịch sử usage chi tiết
 *     description: Lấy danh sách các bản ghi usage chi tiết.
 *
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *
 *     responses:
 *       200:
 *         description: Danh sách usage records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 records:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenUsage'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/usage/history", asyncHandler(getUserHistory));

// =============================================================================
// ADMIN ANALYTICS ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /analytics/admin/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: "[Admin] Tổng quan platform"
 *     description: |
 *       Lấy thống kê tổng quan toàn platform.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: today
 *
 *     responses:
 *       200:
 *         description: Thống kê platform
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                 current:
 *                   $ref: '#/components/schemas/TokenUsageStats'
 *                 previous:
 *                   $ref: '#/components/schemas/TokenUsageStats'
 *                 byType:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenUsageByType'
 *                 daily:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenUsageByDate'
 *                 topUsers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenUsageByUser'
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/admin/overview", adminMiddleware, asyncHandler(getAdminOverview));

/**
 * @swagger
 * /analytics/admin/daily:
 *   get:
 *     tags: [Analytics]
 *     summary: "[Admin] Thống kê theo ngày"
 *     description: Lấy thống kê platform theo ngày.
 *
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *
 *     responses:
 *       200:
 *         description: Thống kê theo ngày
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/admin/daily", adminMiddleware, asyncHandler(getAdminDaily));

/**
 * @swagger
 * /analytics/admin/range:
 *   get:
 *     tags: [Analytics]
 *     summary: "[Admin] Thống kê theo khoảng thời gian"
 *     description: Lấy thống kê platform theo khoảng thời gian tùy chỉnh.
 *
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *
 *     responses:
 *       200:
 *         description: Thống kê theo khoảng thời gian
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/admin/range", adminMiddleware, asyncHandler(getAdminRange));

/**
 * @swagger
 * /analytics/admin/users/{userId}:
 *   get:
 *     tags: [Analytics]
 *     summary: "[Admin] Thống kê user cụ thể"
 *     description: Lấy thống kê của một user cụ thể.
 *
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: month
 *
 *     responses:
 *       200:
 *         description: Thống kê user
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/admin/users/:userId", adminMiddleware, asyncHandler(getAdminUserStats));

/**
 * @swagger
 * /analytics/admin/history:
 *   get:
 *     tags: [Analytics]
 *     summary: "[Admin] Lịch sử usage tất cả users"
 *     description: Lấy danh sách tất cả usage records.
 *
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter theo User ID
 *
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *           enum: [chat, cronjob, api]
 *         description: Filter theo loại request
 *
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *         description: Từ ngày
 *
 *       - in: query
 *         name: end
 *         schema:
 *           type: string
 *           format: date
 *         description: Đến ngày
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *
 *     responses:
 *       200:
 *         description: Danh sách usage records
 *
 *     security:
 *       - BearerAuth: []
 */
analyticsRoutes.get("/admin/history", adminMiddleware, asyncHandler(getAdminHistory));

export default analyticsRoutes;
