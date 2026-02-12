/**
 * Review Routes
 * =============
 * Đánh giá sản phẩm
 */

import { Router } from "express";
import {
  getProductReviews,
  createReview,
  markHelpful,
  checkPurchase,
} from "../controllers/review.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const reviewRoutes = Router();

/**
 * @swagger
 * /products/{slug}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Danh sách đánh giá sản phẩm
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [newest, helpful], default: newest }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: reviews + summary (average, total, distribution)
 *     security: []
 */
reviewRoutes.get("/products/:slug/reviews", getProductReviews);

/**
 * @swagger
 * /products/{slug}/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Viết đánh giá
 *     description: Mỗi user chỉ được đánh giá 1 lần cho mỗi sản phẩm
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               content: { type: string }
 *     responses:
 *       201:
 *         description: Đánh giá đã tạo
 *       409:
 *         description: Đã đánh giá rồi
 */
reviewRoutes.post("/products/:slug/reviews", authMiddleware, createReview);

/**
 * @swagger
 * /products/{slug}/check-purchase:
 *   get:
 *     tags: [Reviews]
 *     summary: Kiểm tra user đã mua sản phẩm chưa
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "{ purchased: boolean }"
 */
reviewRoutes.get("/products/:slug/check-purchase", authMiddleware, checkPurchase);

/**
 * @swagger
 * /reviews/{id}/helpful:
 *   post:
 *     tags: [Reviews]
 *     summary: Đánh dấu hữu ích
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Đã cập nhật helpful count
 *       404:
 *         description: Không tìm thấy review
 */
reviewRoutes.post("/reviews/:id/helpful", authMiddleware, markHelpful);

export default reviewRoutes;
