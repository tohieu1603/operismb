/**
 * Cart Routes
 * ============
 * Giỏ hàng: load, replace, merge (sync giữa FE localStorage và server)
 */

import { Router } from "express";
import { getCart, replaceCart, mergeCart } from "../controllers/cart.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

export const cartRoutes = Router();

// All cart endpoints require authentication
cartRoutes.use(authMiddleware);

/**
 * @swagger
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Load giỏ hàng từ server
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Giỏ hàng hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       product_slug: { type: string }
 *                       quantity: { type: integer }
 *       401:
 *         description: Chưa đăng nhập
 */
cartRoutes.get("/", asyncHandler(getCart));

/**
 * @swagger
 * /cart:
 *   put:
 *     tags: [Cart]
 *     summary: Ghi đè toàn bộ giỏ hàng
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product_slug, quantity]
 *                   properties:
 *                     product_slug: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 */
cartRoutes.put("/", asyncHandler(replaceCart));

/**
 * @swagger
 * /cart/merge:
 *   post:
 *     tags: [Cart]
 *     summary: Merge giỏ hàng local + server (gọi khi login)
 *     description: Lấy quantity lớn hơn giữa local và server cho mỗi slug
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [local_items]
 *             properties:
 *               local_items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product_slug, quantity]
 *                   properties:
 *                     product_slug: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Giỏ hàng đã merge
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       product_slug: { type: string }
 *                       quantity: { type: integer }
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 */
cartRoutes.post("/merge", asyncHandler(mergeCart));

export default cartRoutes;
