/**
 * Order Routes
 * ============
 * Đặt hàng, lịch sử, chi tiết, hủy đơn
 */

import { Router } from "express";
import {
  checkout,
  getUserOrders,
  getOrderDetail,
  cancelOrder,
} from "../controllers/order.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export const orderRoutes = Router();

// All order endpoints require authentication
orderRoutes.use(authMiddleware);

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Đặt hàng (checkout)
 *     description: |
 *       Tạo đơn hàng + tạo deposit order (OD) để thanh toán qua SePay.
 *       Stock sẽ bị trừ ngay. Nếu không thanh toán trong 30 phút, đơn hết hạn.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shipping_name, shipping_phone, shipping_address]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product_slug, quantity]
 *                   properties:
 *                     product_slug: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *               shipping_name: { type: string }
 *               shipping_phone: { type: string }
 *               shipping_address: { type: string }
 *               shipping_note: { type: string }
 *           example:
 *             items:
 *               - product_slug: "ao-thun-operis"
 *                 quantity: 2
 *             shipping_name: "Nguyen Van A"
 *             shipping_phone: "0901234567"
 *             shipping_address: "123 Nguyen Hue, Q1, HCM"
 *     responses:
 *       201:
 *         description: Đơn hàng + thông tin thanh toán (QR, bank)
 *       400:
 *         description: Hết hàng / giỏ trống
 */
orderRoutes.post("/", checkout);

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: Lịch sử đơn hàng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, shipping, delivered, cancelled] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng + items
 */
orderRoutes.get("/", getUserOrders);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Chi tiết đơn hàng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Đơn hàng + items
 *       404:
 *         description: Không tìm thấy
 */
orderRoutes.get("/:id", getOrderDetail);

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     tags: [Orders]
 *     summary: Hủy đơn hàng
 *     description: Chỉ hủy được đơn ở trạng thái "pending". Stock sẽ được hoàn lại.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Đã hủy
 *       400:
 *         description: Không thể hủy (đơn không ở trạng thái pending)
 */
orderRoutes.delete("/:id", cancelOrder);

export default orderRoutes;
