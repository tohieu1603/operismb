/**
 * API Key Routes
 * ==============
 * Quản lý API keys cho programmatic access
 *
 * Module này cho phép:
 * - User quản lý API keys của mình
 * - Admin quản lý tất cả API keys
 *
 * API Key dùng để:
 * - Gọi API từ scripts/integrations
 * - Không cần refresh như JWT token
 * - Có thể set expiration date
 *
 * ⚠️ Key chỉ hiển thị đầy đủ 1 lần khi tạo
 */

import { Router } from "express";
import { apiKeyController } from "../controllers/api-key.controller.js";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index.js";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// =============================================================================
// USER ROUTES - User quản lý keys của mình
// =============================================================================

/**
 * @swagger
 * /keys:
 *   get:
 *     tags: [API Keys]
 *     summary: Danh sách API keys của tôi
 *     description: |
 *       Lấy danh sách tất cả API keys của user hiện tại.
 *
 *       **Thông tin trả về:**
 *       - ID và tên key
 *       - Prefix của key (4 ký tự đầu)
 *       - Trạng thái active/inactive
 *       - Thời gian tạo và hết hạn
 *       - Lần sử dụng cuối
 *
 *       **Lưu ý:**
 *       - Key đầy đủ KHÔNG được trả về (chỉ hiện khi tạo)
 *       - Có thể filter theo trạng thái
 *
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter theo trạng thái active
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Số lượng keys mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Số keys bỏ qua
 *
 *     responses:
 *       200:
 *         description: Danh sách API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *                 total:
 *                   type: integer
 *             example:
 *               keys:
 *                 - id: "key_abc123"
 *                   name: "Production API"
 *                   prefix: "opk_"
 *                   lastChars: "...x7y9"
 *                   isActive: true
 *                   expiresAt: "2025-01-15T00:00:00Z"
 *                   lastUsedAt: "2024-03-20T14:30:00Z"
 *                   createdAt: "2024-01-15T10:30:00Z"
 *                 - id: "key_def456"
 *                   name: "Development"
 *                   prefix: "opk_"
 *                   lastChars: "...a2b3"
 *                   isActive: false
 *                   expiresAt: null
 *                   lastUsedAt: "2024-02-10T08:15:00Z"
 *                   createdAt: "2024-02-01T09:00:00Z"
 *               total: 2
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/",
  asyncHandler((req, res) => apiKeyController.list(req, res)),
);

/**
 * @swagger
 * /keys:
 *   post:
 *     tags: [API Keys]
 *     summary: Tạo API key mới
 *     description: |
 *       Tạo một API key mới cho user hiện tại.
 *
 *       ⚠️ **QUAN TRỌNG:**
 *       - Key đầy đủ CHỈ HIỂN THỊ 1 LẦN trong response này
 *       - Sau đó không thể xem lại key
 *       - Hãy lưu key ngay lập tức và bảo mật
 *
 *       **Tùy chọn:**
 *       - `name`: Tên mô tả key (bắt buộc)
 *       - `expiresAt`: Thời gian hết hạn (optional)
 *       - `permissions`: Danh sách permissions (optional)
 *
 *       **Format key:**
 *       - Prefix: `opk_` (Operis API Key)
 *       - Độ dài: 48 ký tự (sau prefix)
 *       - Ví dụ: `opk_abc123def456ghi789jkl012mno345pqr678stu901vwx`
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiKeyCreateRequest'
 *           examples:
 *             basic:
 *               summary: Tạo key cơ bản
 *               value:
 *                 name: "My API Key"
 *             withExpiry:
 *               summary: Có thời hạn
 *               value:
 *                 name: "Temporary Key"
 *                 expiresAt: "2025-12-31T23:59:59Z"
 *             withPermissions:
 *               summary: Giới hạn permissions
 *               value:
 *                 name: "Chat Only Key"
 *                 permissions: ["chat:send", "chat:read"]
 *
 *     responses:
 *       201:
 *         description: Tạo key thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKeyCreateResponse'
 *             example:
 *               id: "key_abc123"
 *               name: "My API Key"
 *               key: "opk_abc123def456ghi789jkl012mno345pqr678stu901vwx"
 *               prefix: "opk_"
 *               isActive: true
 *               expiresAt: null
 *               createdAt: "2024-03-20T15:00:00Z"
 *               message: "⚠️ Lưu key ngay! Key sẽ không hiển thị lại."
 *
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               missingName:
 *                 summary: Thiếu tên
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "name"
 *                     message: "Tên key là bắt buộc"
 *               invalidExpiry:
 *                 summary: Thời hạn không hợp lệ
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "expiresAt"
 *                     message: "Thời hạn phải là ngày trong tương lai"
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       429:
 *         description: Đã đạt giới hạn số key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Đã đạt giới hạn 10 API keys"
 *               code: "KEY_LIMIT_REACHED"
 *
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/",
  asyncHandler((req, res) => apiKeyController.create(req, res)),
);

/**
 * @swagger
 * /keys/{id}:
 *   patch:
 *     tags: [API Keys]
 *     summary: Cập nhật API key
 *     description: |
 *       Cập nhật thông tin API key của user hiện tại.
 *
 *       **Có thể cập nhật:**
 *       - `name`: Đổi tên key
 *       - `isActive`: Enable/disable key
 *       - `expiresAt`: Thay đổi thời hạn
 *
 *       **Không thể cập nhật:**
 *       - Key value (phải tạo key mới)
 *       - Owner (key gắn với user tạo)
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key ID
 *         example: "key_abc123"
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên mới
 *               isActive:
 *                 type: boolean
 *                 description: Trạng thái active
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Thời hạn mới
 *           examples:
 *             rename:
 *               summary: Đổi tên
 *               value:
 *                 name: "Production v2"
 *             disable:
 *               summary: Vô hiệu hóa
 *               value:
 *                 isActive: false
 *             extendExpiry:
 *               summary: Gia hạn
 *               value:
 *                 expiresAt: "2026-01-01T00:00:00Z"
 *
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKey'
 *
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không phải key của bạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Không có quyền truy cập key này"
 *               code: "FORBIDDEN"
 *
 *       404:
 *         description: Key không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/:id",
  asyncHandler((req, res) => apiKeyController.update(req, res)),
);

/**
 * @swagger
 * /keys/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: Xóa (revoke) API key
 *     description: |
 *       Xóa vĩnh viễn API key của user hiện tại.
 *
 *       ⚠️ **Cảnh báo:**
 *       - Thao tác này KHÔNG THỂ hoàn tác
 *       - Key bị xóa sẽ ngay lập tức không còn hoạt động
 *       - Mọi request sử dụng key này sẽ bị từ chối
 *
 *       **Use cases:**
 *       - Key bị lộ, cần revoke ngay
 *       - Dọn dẹp keys không dùng
 *       - Rotate keys định kỳ
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key ID cần xóa
 *
 *     responses:
 *       204:
 *         description: Xóa thành công (No Content)
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không phải key của bạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Key không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  "/:id",
  asyncHandler((req, res) => apiKeyController.delete(req, res)),
);

// =============================================================================
// ADMIN ROUTES - Admin quản lý tất cả keys
// =============================================================================

/**
 * @swagger
 * /keys/admin/all:
 *   get:
 *     tags: [API Keys]
 *     summary: "[Admin] Danh sách tất cả API keys"
 *     description: |
 *       Lấy danh sách tất cả API keys trong hệ thống.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Hỗ trợ filter:**
 *       - `userId`: Filter theo user
 *       - `active`: Filter theo trạng thái
 *       - `expired`: Filter keys đã hết hạn
 *
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter theo User ID
 *
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter theo trạng thái active
 *
 *       - in: query
 *         name: expired
 *         schema:
 *           type: boolean
 *         description: Filter keys đã hết hạn
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Số lượng mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Số records bỏ qua
 *
 *     responses:
 *       200:
 *         description: Danh sách keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/ApiKey'
 *                       - type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           userEmail:
 *                             type: string
 *                 total:
 *                   type: integer
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
router.get(
  "/admin/all",
  adminMiddleware,
  asyncHandler((req, res) => apiKeyController.listAll(req, res)),
);

/**
 * @swagger
 * /keys/admin/{id}:
 *   patch:
 *     tags: [API Keys]
 *     summary: "[Admin] Cập nhật bất kỳ API key"
 *     description: |
 *       Admin cập nhật bất kỳ API key nào trong hệ thống.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Use cases:**
 *       - Disable key vi phạm
 *       - Gia hạn key cho user
 *       - Sửa thông tin key
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key ID
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               note:
 *                 type: string
 *                 description: Ghi chú admin
 *
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKey'
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
 *       404:
 *         description: Key không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/admin/:id",
  adminMiddleware,
  asyncHandler((req, res) => apiKeyController.adminUpdate(req, res)),
);

/**
 * @swagger
 * /keys/admin/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: "[Admin] Xóa bất kỳ API key"
 *     description: |
 *       Admin xóa bất kỳ API key nào trong hệ thống.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       ⚠️ **Cảnh báo:**
 *       - Thao tác KHÔNG THỂ hoàn tác
 *       - Nên thông báo cho user trước khi xóa
 *
 *       **Use cases:**
 *       - Key bị compromise
 *       - User vi phạm policy
 *       - Cleanup orphaned keys
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key ID cần xóa
 *
 *     responses:
 *       204:
 *         description: Xóa thành công
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
 *       404:
 *         description: Key không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  "/admin/:id",
  adminMiddleware,
  asyncHandler((req, res) => apiKeyController.adminDelete(req, res)),
);

export default router;
