/**
 * Question Routes
 * ===============
 * Hỏi đáp sản phẩm
 */

import { Router } from "express";
import {
  getProductQuestions,
  askQuestion,
  answerQuestion,
} from "../controllers/question.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware.js";

export const questionRoutes = Router();

/**
 * @swagger
 * /products/{slug}/questions:
 *   get:
 *     tags: [Questions]
 *     summary: Danh sách câu hỏi sản phẩm
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: questions + answers
 *     security: []
 */
questionRoutes.get("/products/:slug/questions", getProductQuestions);

/**
 * @swagger
 * /products/{slug}/questions:
 *   post:
 *     tags: [Questions]
 *     summary: Đặt câu hỏi
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
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       201:
 *         description: Câu hỏi đã tạo
 *       404:
 *         description: Sản phẩm không tồn tại
 */
questionRoutes.post("/products/:slug/questions", authMiddleware, askQuestion);

/**
 * @swagger
 * /questions/{id}/answer:
 *   patch:
 *     tags: [Questions]
 *     summary: Trả lời câu hỏi (admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       200:
 *         description: Câu hỏi + tất cả câu trả lời
 *       404:
 *         description: Không tìm thấy câu hỏi
 */
questionRoutes.patch("/questions/:id/answer", authMiddleware, adminMiddleware, answerQuestion);

export default questionRoutes;
