/**
 * Settings Routes
 * ===============
 * System configuration endpoints
 *
 * Module này dành cho Admin quản lý cấu hình hệ thống:
 * - LLM providers (Anthropic, OpenAI, etc.)
 * - Pricing configuration
 * - Feature flags
 * - System settings
 *
 * ⚠️ Tất cả endpoints yêu cầu quyền Admin
 */

import { Router } from "express";
import { getSettings, saveSettings } from "../controllers/settings.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

// All settings endpoints require admin auth

/**
 * @swagger
 * /settings:
 *   get:
 *     tags: [Settings]
 *     summary: Lấy cấu hình hệ thống
 *     description: |
 *       Lấy toàn bộ cấu hình hệ thống hiện tại.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Các nhóm cấu hình:**
 *       - `llm`: Cấu hình LLM providers
 *       - `pricing`: Bảng giá và rates
 *       - `features`: Feature flags
 *       - `limits`: Rate limits và quotas
 *       - `payment`: Payment gateway settings
 *       - `notification`: Email/SMS settings
 *
 *     responses:
 *       200:
 *         description: Cấu hình hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Settings'
 *             example:
 *               llm:
 *                 defaultModel: "claude-sonnet-4-20250514"
 *                 availableModels:
 *                   - id: "claude-opus-4-20250514"
 *                     name: "Claude Opus 4"
 *                     enabled: true
 *                     inputPrice: 15
 *                     outputPrice: 75
 *                   - id: "claude-sonnet-4-20250514"
 *                     name: "Claude Sonnet 4"
 *                     enabled: true
 *                     inputPrice: 3
 *                     outputPrice: 15
 *               pricing:
 *                 tokenRate: 10
 *                 currency: "VND"
 *                 tiers:
 *                   - id: "tier_basic"
 *                     name: "Basic"
 *                     price: 50000
 *                     tokens: 500000
 *               features:
 *                 registrationEnabled: true
 *                 chatEnabled: true
 *                 depositEnabled: true
 *               limits:
 *                 chatRateLimit: 20
 *                 maxConversations: 100
 *                 maxApiKeys: 10
 *               payment:
 *                 provider: "sepay"
 *                 bankAccount: "0123456789"
 *                 bankName: "MB Bank"
 *               updatedAt: "2024-03-20T14:00:00Z"
 *               updatedBy: "admin@operis.io"
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Yêu cầu quyền Admin"
 *               code: "FORBIDDEN"
 *
 *     security:
 *       - BearerAuth: []
 */
router.get("/", authMiddleware, adminMiddleware, asyncHandler(getSettings));

/**
 * @swagger
 * /settings:
 *   post:
 *     tags: [Settings]
 *     summary: Lưu cấu hình hệ thống
 *     description: |
 *       Cập nhật cấu hình hệ thống.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Lưu ý:**
 *       - Chỉ gửi các fields cần update
 *       - Merge với config hiện tại
 *       - Một số settings cần restart để apply
 *
 *       **Validation:**
 *       - Giá token phải > 0
 *       - Model IDs phải hợp lệ
 *       - Rate limits phải hợp lý
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Settings'
 *           examples:
 *             updatePricing:
 *               summary: Cập nhật giá
 *               value:
 *                 pricing:
 *                   tokenRate: 12
 *                   tiers:
 *                     - id: "tier_basic"
 *                       price: 60000
 *                       tokens: 500000
 *             disableFeature:
 *               summary: Tắt feature
 *               value:
 *                 features:
 *                   registrationEnabled: false
 *             updateLimits:
 *               summary: Cập nhật rate limits
 *               value:
 *                 limits:
 *                   chatRateLimit: 30
 *                   maxConversations: 200
 *             fullConfig:
 *               summary: Full config update
 *               value:
 *                 llm:
 *                   defaultModel: "claude-opus-4-20250514"
 *                 pricing:
 *                   tokenRate: 15
 *                 features:
 *                   depositEnabled: true
 *
 *     responses:
 *       200:
 *         description: Lưu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 settings:
 *                   $ref: '#/components/schemas/Settings'
 *                 message:
 *                   type: string
 *                 changedFields:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Danh sách fields đã thay đổi
 *             example:
 *               success: true
 *               settings:
 *                 pricing:
 *                   tokenRate: 12
 *               message: "Cấu hình đã được lưu"
 *               changedFields: ["pricing.tokenRate", "pricing.tiers"]
 *
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalidPrice:
 *                 summary: Giá không hợp lệ
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "pricing.tokenRate"
 *                     message: "Giá token phải lớn hơn 0"
 *               invalidModel:
 *                 summary: Model không hợp lệ
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "llm.defaultModel"
 *                     message: "Model không tồn tại"
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.post("/", authMiddleware, adminMiddleware, asyncHandler(saveSettings));

export const settingsRoutes = router;
export default router;
