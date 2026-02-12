/**
 * Token Routes
 * ============
 * Quản lý số dư token và lịch sử giao dịch
 *
 * Token là đơn vị tiền tệ trong hệ thống:
 * - Dùng để trả phí khi gọi AI models
 * - Có thể mua thêm qua deposit
 * - Admin có thể credit/debit trực tiếp
 *
 * Module này cung cấp:
 * - User: Xem số dư và lịch sử
 * - Admin: Quản lý token cho users
 */

import { Router } from "express";
import { tokenController } from "../controllers/token.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// =============================================================================
// USER ROUTES - Xem số dư và lịch sử giao dịch
// =============================================================================

/**
 * @swagger
 * /tokens/balance:
 *   get:
 *     tags: [Tokens]
 *     summary: Xem số dư token
 *     description: |
 *       Lấy số dư token hiện tại của user.
 *
 *       **Thông tin trả về:**
 *       - `balance`: Số dư hiện tại (tokens)
 *       - `totalDeposited`: Tổng tokens đã nạp
 *       - `totalSpent`: Tổng tokens đã sử dụng
 *       - `lastUpdated`: Thời điểm cập nhật cuối
 *
 *       **Đơn vị:**
 *       - 1 token ~ 1 input/output token của AI model
 *       - Giá token được quy định trong pricing
 *
 *     responses:
 *       200:
 *         description: Số dư token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenBalance'
 *             example:
 *               balance: 1500000
 *               totalDeposited: 5000000
 *               totalSpent: 3500000
 *               currency: "tokens"
 *               lastUpdated: "2024-03-20T14:45:00Z"
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
  "/balance",
  asyncHandler((req, res) => tokenController.getBalance(req, res)),
);

/**
 * @swagger
 * /tokens/transactions:
 *   get:
 *     tags: [Tokens]
 *     summary: Lịch sử giao dịch token
 *     description: |
 *       Lấy lịch sử giao dịch token của user hiện tại.
 *
 *       **Các loại giao dịch:**
 *       - `deposit`: Nạp tiền mua token
 *       - `usage`: Sử dụng token (gọi AI)
 *       - `admin_credit`: Admin cộng token
 *       - `admin_debit`: Admin trừ token
 *       - `refund`: Hoàn token
 *       - `bonus`: Thưởng token
 *
 *       **Hỗ trợ filter:**
 *       - `type`: Filter theo loại giao dịch
 *       - `from`/`to`: Khoảng thời gian
 *
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, usage, admin_credit, admin_debit, refund, bonus]
 *         description: Filter theo loại giao dịch
 *
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Từ thời điểm (ISO 8601)
 *
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Đến thời điểm (ISO 8601)
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Số giao dịch mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Số giao dịch bỏ qua
 *
 *     responses:
 *       200:
 *         description: Danh sách giao dịch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenTransaction'
 *                 total:
 *                   type: integer
 *             example:
 *               transactions:
 *                 - id: "txn_abc123"
 *                   type: "deposit"
 *                   amount: 1000000
 *                   balance: 1500000
 *                   description: "Nạp tiền qua chuyển khoản"
 *                   reference: "dep_xyz789"
 *                   createdAt: "2024-03-20T14:00:00Z"
 *                 - id: "txn_def456"
 *                   type: "usage"
 *                   amount: -50000
 *                   balance: 500000
 *                   description: "Chat với Claude Opus"
 *                   reference: "chat_uvw321"
 *                   metadata:
 *                     model: "claude-opus-4-20250514"
 *                     inputTokens: 1500
 *                     outputTokens: 800
 *                   createdAt: "2024-03-20T10:30:00Z"
 *               total: 45
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
  "/transactions",
  asyncHandler((req, res) => tokenController.getTransactions(req, res)),
);

// =============================================================================
// USAGE DEDUCTION - Trừ token sau khi dùng AI
// =============================================================================

/**
 * @swagger
 * /tokens/usage:
 *   post:
 *     tags: [Tokens]
 *     summary: Trừ token sau khi dùng AI
 *     description: |
 *       Client gọi sau mỗi chat để trừ token đã dùng.
 *       Ghi log usage analytics + trừ balance.
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt_tokens, completion_tokens, total_tokens]
 *             properties:
 *               prompt_tokens:
 *                 type: integer
 *               completion_tokens:
 *                 type: integer
 *               total_tokens:
 *                 type: integer
 *               model:
 *                 type: string
 *               request_type:
 *                 type: string
 *                 enum: [chat, cronjob, api]
 *               request_id:
 *                 type: string
 *               metadata:
 *                 type: object
 *           example:
 *             prompt_tokens: 39909
 *             completion_tokens: 61
 *             total_tokens: 39970
 *             model: "claude-sonnet-4-5-20250929"
 *
 *     responses:
 *       200:
 *         description: Token deducted
 *         content:
 *           application/json:
 *             example:
 *               balance: 9960030
 *               deducted: 39970
 *               usage_id: "uuid"
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/usage",
  asyncHandler((req, res) => tokenController.deductUsage(req, res)),
);

// =============================================================================
// ADMIN ROUTES - Quản lý token cho users
// =============================================================================

/**
 * @swagger
 * /tokens/admin/all:
 *   get:
 *     tags: [Tokens]
 *     summary: "[Admin] Tất cả giao dịch"
 *     description: |
 *       Lấy lịch sử giao dịch token của tất cả users.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Hỗ trợ filter:**
 *       - `userId`: Filter theo user
 *       - `type`: Filter theo loại giao dịch
 *       - `from`/`to`: Khoảng thời gian
 *
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter theo User ID
 *
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, usage, admin_credit, admin_debit, refund, bonus]
 *         description: Filter theo loại giao dịch
 *
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Từ thời điểm
 *
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Đến thời điểm
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Số giao dịch mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Số giao dịch bỏ qua
 *
 *     responses:
 *       200:
 *         description: Danh sách giao dịch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/TokenTransaction'
 *                       - type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           userEmail:
 *                             type: string
 *                 total:
 *                   type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalDeposited:
 *                       type: integer
 *                     totalSpent:
 *                       type: integer
 *                     netChange:
 *                       type: integer
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
  asyncHandler((req, res) => tokenController.getAllTransactions(req, res)),
);

/**
 * @swagger
 * /tokens/admin/user/{userId}:
 *   get:
 *     tags: [Tokens]
 *     summary: "[Admin] Giao dịch của user"
 *     description: |
 *       Lấy lịch sử giao dịch token của một user cụ thể.
 *
 *       **Chỉ Admin mới có quyền.**
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, usage, admin_credit, admin_debit, refund, bonus]
 *         description: Filter theo loại
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
 *         description: Danh sách giao dịch của user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 balance:
 *                   $ref: '#/components/schemas/TokenBalance'
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TokenTransaction'
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
 *       404:
 *         description: User không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/admin/user/:userId",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.getUserTransactions(req, res)),
);

/**
 * @swagger
 * /tokens/admin/credit:
 *   post:
 *     tags: [Tokens]
 *     summary: "[Admin] Cộng token cho user"
 *     description: |
 *       Admin cộng token trực tiếp cho user.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Use cases:**
 *       - Nạp token thủ công
 *       - Hoàn token do lỗi
 *       - Tặng token khuyến mãi
 *       - Bồi thường sự cố
 *
 *       **Lưu ý:**
 *       - Transaction được ghi log với type `admin_credit`
 *       - Có thể thêm note giải thích lý do
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID cần cộng token
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Số token cần cộng
 *               note:
 *                 type: string
 *                 description: Ghi chú lý do
 *           examples:
 *             basicCredit:
 *               summary: Cộng token cơ bản
 *               value:
 *                 userId: "usr_abc123"
 *                 amount: 500000
 *             creditWithNote:
 *               summary: Cộng kèm ghi chú
 *               value:
 *                 userId: "usr_abc123"
 *                 amount: 100000
 *                 note: "Hoàn token do lỗi API ngày 20/03"
 *
 *     responses:
 *       200:
 *         description: Cộng token thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   $ref: '#/components/schemas/TokenTransaction'
 *                 newBalance:
 *                   type: integer
 *                 message:
 *                   type: string
 *             example:
 *               success: true
 *               transaction:
 *                 id: "txn_abc123"
 *                 type: "admin_credit"
 *                 amount: 500000
 *                 balance: 2000000
 *               newBalance: 2000000
 *               message: "Đã cộng 500,000 tokens"
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
 *         description: Không có quyền Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: User không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/admin/credit",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.credit(req, res)),
);

/**
 * @swagger
 * /tokens/admin/debit:
 *   post:
 *     tags: [Tokens]
 *     summary: "[Admin] Trừ token của user"
 *     description: |
 *       Admin trừ token của user.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       ⚠️ **Cảnh báo:**
 *       - Thao tác này trừ token trực tiếp
 *       - Có thể khiến số dư âm nếu force=true
 *       - Nên có lý do rõ ràng
 *
 *       **Use cases:**
 *       - Thu hồi token credit nhầm
 *       - Xử lý fraud/abuse
 *       - Điều chỉnh số dư
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID cần trừ token
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Số token cần trừ
 *               note:
 *                 type: string
 *                 description: Ghi chú lý do (bắt buộc)
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: Cho phép trừ xuống âm
 *           example:
 *             userId: "usr_abc123"
 *             amount: 100000
 *             note: "Thu hồi token credit nhầm"
 *
 *     responses:
 *       200:
 *         description: Trừ token thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   $ref: '#/components/schemas/TokenTransaction'
 *                 newBalance:
 *                   type: integer
 *                 message:
 *                   type: string
 *
 *       400:
 *         description: Không đủ số dư hoặc thiếu note
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               insufficientBalance:
 *                 summary: Không đủ số dư
 *                 value:
 *                   error: "Số dư không đủ. Hiện có: 50,000 tokens"
 *                   code: "INSUFFICIENT_BALANCE"
 *               missingNote:
 *                 summary: Thiếu ghi chú
 *                 value:
 *                   error: "Ghi chú là bắt buộc khi trừ token"
 *                   code: "VALIDATION_ERROR"
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
 *         description: User không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/admin/debit",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.debit(req, res)),
);

/**
 * @swagger
 * /tokens/admin/adjust:
 *   post:
 *     tags: [Tokens]
 *     summary: "[Admin] Điều chỉnh số dư token"
 *     description: |
 *       Admin điều chỉnh số dư token về một giá trị cụ thể.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Khác với credit/debit:**
 *       - Credit/debit: Cộng/trừ một số lượng
 *       - Adjust: Set số dư về giá trị cụ thể
 *
 *       **Use cases:**
 *       - Fix số dư bị sai do lỗi
 *       - Reset số dư về 0
 *       - Đồng bộ từ hệ thống khác
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - newBalance
 *               - note
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *               newBalance:
 *                 type: integer
 *                 minimum: 0
 *                 description: Số dư mới
 *               note:
 *                 type: string
 *                 description: Ghi chú lý do (bắt buộc)
 *           example:
 *             userId: "usr_abc123"
 *             newBalance: 1000000
 *             note: "Điều chỉnh số dư sau khi xử lý dispute"
 *
 *     responses:
 *       200:
 *         description: Điều chỉnh thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 oldBalance:
 *                   type: integer
 *                 newBalance:
 *                   type: integer
 *                 difference:
 *                   type: integer
 *                 transaction:
 *                   $ref: '#/components/schemas/TokenTransaction'
 *                 message:
 *                   type: string
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
 *         description: Không có quyền Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: User không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/admin/adjust",
  adminMiddleware,
  asyncHandler((req, res) => tokenController.adjust(req, res)),
);

export default router;
