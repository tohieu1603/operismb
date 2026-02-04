/**
 * Deposit Routes
 * ==============
 * Nạp tiền và mua token qua chuyển khoản ngân hàng
 *
 * Module này cung cấp:
 * - Xem bảng giá token
 * - Tạo đơn nạp tiền
 * - Theo dõi trạng thái đơn nạp
 * - Lịch sử nạp tiền
 * - Webhook nhận thông báo từ payment gateway
 *
 * **Flow nạp tiền:**
 * 1. User gọi GET /deposits/pricing xem bảng giá
 * 2. User gọi POST /deposits tạo đơn nạp
 * 3. User chuyển khoản theo thông tin trả về
 * 4. Hệ thống nhận webhook từ SePay
 * 5. Token được cộng tự động
 */

import { Router } from "express";
import {
  getPricing,
  createDeposit,
  getDeposit,
  getPendingOrder,
  cancelPendingOrder,
  getDepositHistory,
  getTokenHistory,
  adminUpdateTokens,
  adminGetAllDeposits,
  sepayWebhook,
} from "../controllers/deposit.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware.js";

export const depositRoutes = Router();

// =============================================================================
// PUBLIC ENDPOINTS - Không cần authentication
// =============================================================================

/**
 * @swagger
 * /deposits/pricing:
 *   get:
 *     tags: [Deposits]
 *     summary: Bảng giá token
 *     description: |
 *       Lấy bảng giá các gói token có sẵn.
 *
 *       **Không cần authentication.**
 *
 *       **Thông tin trả về:**
 *       - Danh sách các gói token
 *       - Giá mỗi gói (VND)
 *       - Số token nhận được
 *       - Bonus (nếu có)
 *
 *     responses:
 *       200:
 *         description: Bảng giá token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pricing'
 *             example:
 *               tiers:
 *                 - id: "tier_basic"
 *                   name: "Basic"
 *                   price: 50000
 *                   tokens: 500000
 *                   bonus: 0
 *                   popular: false
 *                 - id: "tier_pro"
 *                   name: "Pro"
 *                   price: 200000
 *                   tokens: 2200000
 *                   bonus: 200000
 *                   popular: true
 *                 - id: "tier_enterprise"
 *                   name: "Enterprise"
 *                   price: 1000000
 *                   tokens: 12000000
 *                   bonus: 2000000
 *                   popular: false
 *               currency: "VND"
 *               note: "Giá đã bao gồm VAT"
 *
 *     security: []
 */
depositRoutes.get("/pricing", getPricing);

/**
 * @swagger
 * /deposits/webhook/sepay:
 *   post:
 *     tags: [Deposits]
 *     summary: Webhook nhận thông báo từ SePay
 *     description: |
 *       Endpoint nhận callback từ SePay payment gateway.
 *
 *       **Không cần authentication** - Sử dụng signature verification.
 *
 *       ⚠️ **Nội bộ:** Endpoint này chỉ dành cho SePay gọi.
 *
 *       **Xử lý:**
 *       1. Verify signature từ SePay
 *       2. Tìm đơn nạp theo mã giao dịch
 *       3. Cập nhật trạng thái đơn nạp
 *       4. Cộng token cho user nếu thành công
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: SePay transaction ID
 *               gateway:
 *                 type: string
 *                 description: Bank gateway
 *               transactionDate:
 *                 type: string
 *                 description: Thời gian giao dịch
 *               accountNumber:
 *                 type: string
 *                 description: Số tài khoản nhận
 *               transferType:
 *                 type: string
 *                 description: Loại chuyển khoản (in/out)
 *               transferAmount:
 *                 type: number
 *                 description: Số tiền
 *               content:
 *                 type: string
 *                 description: Nội dung chuyển khoản (chứa mã đơn)
 *
 *     responses:
 *       200:
 *         description: Webhook processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *
 *       400:
 *         description: Invalid webhook data
 *
 *       401:
 *         description: Invalid signature
 *
 *     security: []
 */
depositRoutes.post("/webhook/sepay", sepayWebhook);

// Protected endpoints (require auth)
depositRoutes.use(authMiddleware);

// =============================================================================
// USER ENDPOINTS - Yêu cầu JWT authentication
// =============================================================================

/**
 * @swagger
 * /deposits:
 *   post:
 *     tags: [Deposits]
 *     summary: Tạo đơn nạp tiền
 *     description: |
 *       Tạo đơn nạp tiền mới.
 *
 *       **Flow nạp tiền:**
 *       1. Chọn gói từ bảng giá (hoặc nhập số tiền custom)
 *       2. Gọi endpoint này để tạo đơn
 *       3. Nhận thông tin chuyển khoản (bank, account, amount, content)
 *       4. Chuyển khoản đúng thông tin
 *       5. Token được cộng tự động trong 1-5 phút
 *
 *       **Lưu ý:**
 *       - Mỗi user chỉ có tối đa 1 đơn pending
 *       - Đơn pending hết hạn sau 24h
 *       - Nội dung chuyển khoản phải ĐÚNG NGUYÊN VĂN
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tierId:
 *                 type: string
 *                 description: ID gói từ bảng giá
 *               amount:
 *                 type: integer
 *                 description: Số tiền custom (nếu không dùng tier)
 *           examples:
 *             fromTier:
 *               summary: Chọn gói có sẵn
 *               value:
 *                 tierId: "tier_pro"
 *             customAmount:
 *               summary: Số tiền custom
 *               value:
 *                 amount: 150000
 *
 *     responses:
 *       201:
 *         description: Đơn nạp tiền đã tạo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepositOrder'
 *             example:
 *               id: "dep_abc123"
 *               status: "pending"
 *               amount: 200000
 *               tokens: 2200000
 *               paymentInfo:
 *                 bankName: "MB Bank"
 *                 accountNumber: "0123456789"
 *                 accountName: "CONG TY OPERIS"
 *                 amount: 200000
 *                 content: "OPERIS DEP ABC123"
 *               expiresAt: "2024-03-21T15:00:00Z"
 *               createdAt: "2024-03-20T15:00:00Z"
 *               note: "Chuyển khoản ĐÚNG số tiền và nội dung"
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
 *       409:
 *         description: Đã có đơn pending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Bạn đã có đơn nạp đang chờ thanh toán"
 *               code: "PENDING_ORDER_EXISTS"
 *               pendingOrderId: "dep_xyz789"
 *
 *     security:
 *       - BearerAuth: []
 */
depositRoutes.post("/", createDeposit);

/**
 * @swagger
 * /deposits/pending:
 *   get:
 *     tags: [Deposits]
 *     summary: Đơn nạp đang chờ
 *     description: |
 *       Lấy đơn nạp tiền đang pending (nếu có).
 *
 *       Mỗi user chỉ có tối đa 1 đơn pending.
 *
 *     responses:
 *       200:
 *         description: Đơn nạp pending (hoặc null)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/DepositOrder'
 *                 - type: object
 *                   properties:
 *                     order:
 *                       type: "null"
 *             example:
 *               id: "dep_abc123"
 *               status: "pending"
 *               amount: 200000
 *               tokens: 2200000
 *               paymentInfo:
 *                 bankName: "MB Bank"
 *                 accountNumber: "0123456789"
 *                 accountName: "CONG TY OPERIS"
 *                 amount: 200000
 *                 content: "OPERIS DEP ABC123"
 *               expiresAt: "2024-03-21T15:00:00Z"
 *               createdAt: "2024-03-20T15:00:00Z"
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
depositRoutes.get("/pending", getPendingOrder);

/**
 * @swagger
 * /deposits/{id}:
 *   delete:
 *     tags: [Deposits]
 *     summary: Hủy đơn nạp
 *     description: |
 *       Hủy đơn nạp tiền đang pending.
 *
 *       **Chỉ hủy được đơn:**
 *       - Ở trạng thái `pending`
 *       - Thuộc về user hiện tại
 *
 *       **Không hủy được:**
 *       - Đơn đã hoàn thành
 *       - Đơn đã hết hạn
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Deposit order ID
 *
 *     responses:
 *       204:
 *         description: Hủy thành công
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền hủy đơn này
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Đơn không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       409:
 *         description: Không thể hủy đơn ở trạng thái này
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Không thể hủy đơn đã hoàn thành"
 *               code: "CANNOT_CANCEL"
 *
 *     security:
 *       - BearerAuth: []
 */
depositRoutes.delete("/:id", cancelPendingOrder);

/**
 * @swagger
 * /deposits/history:
 *   get:
 *     tags: [Deposits]
 *     summary: Lịch sử nạp tiền
 *     description: |
 *       Lấy lịch sử các đơn nạp tiền của user.
 *
 *       **Trạng thái đơn:**
 *       - `pending`: Đang chờ thanh toán
 *       - `completed`: Đã hoàn thành
 *       - `cancelled`: Đã hủy
 *       - `expired`: Hết hạn
 *
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled, expired]
 *         description: Filter theo trạng thái
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số đơn mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Số đơn bỏ qua
 *
 *     responses:
 *       200:
 *         description: Danh sách đơn nạp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deposits:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DepositOrder'
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
 *     security:
 *       - BearerAuth: []
 */
depositRoutes.get("/history", getDepositHistory);

/**
 * @swagger
 * /deposits/tokens/history:
 *   get:
 *     tags: [Deposits]
 *     summary: Lịch sử token từ deposits
 *     description: |
 *       Lấy lịch sử token nhận được từ các đơn nạp tiền.
 *
 *       Tương tự `/tokens/transactions` nhưng chỉ filter
 *       các transactions từ deposits.
 *
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *
 *     responses:
 *       200:
 *         description: Lịch sử token
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
 *                 totalTokens:
 *                   type: integer
 *                   description: Tổng token đã nạp
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
depositRoutes.get("/tokens/history", getTokenHistory);

/**
 * @swagger
 * /deposits/{id}:
 *   get:
 *     tags: [Deposits]
 *     summary: Chi tiết đơn nạp
 *     description: |
 *       Lấy thông tin chi tiết của một đơn nạp tiền.
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Deposit order ID
 *
 *     responses:
 *       200:
 *         description: Chi tiết đơn nạp
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepositOrder'
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền xem đơn này
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Đơn không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
depositRoutes.get("/:id", getDeposit);

// =============================================================================
// ADMIN ENDPOINTS - Yêu cầu quyền Admin
// =============================================================================

/**
 * @swagger
 * /deposits/admin/all:
 *   get:
 *     tags: [Deposits]
 *     summary: "[Admin] Tất cả đơn nạp"
 *     description: |
 *       Lấy danh sách tất cả đơn nạp tiền trong hệ thống.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter theo User ID
 *
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled, expired]
 *         description: Filter theo trạng thái
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
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *
 *     responses:
 *       200:
 *         description: Danh sách đơn nạp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deposits:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/DepositOrder'
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
 *                     totalAmount:
 *                       type: integer
 *                     totalTokens:
 *                       type: integer
 *                     pendingCount:
 *                       type: integer
 *                     completedCount:
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
depositRoutes.get("/admin/all", adminMiddleware, adminGetAllDeposits);

/**
 * @swagger
 * /deposits/admin/tokens:
 *   post:
 *     tags: [Deposits]
 *     summary: "[Admin] Cập nhật token thủ công"
 *     description: |
 *       Admin cập nhật trạng thái đơn và cộng token thủ công.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Use cases:**
 *       - Xử lý đơn bị miss webhook
 *       - Cộng token cho chuyển khoản sai format
 *       - Fix đơn có vấn đề
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - depositId
 *               - action
 *             properties:
 *               depositId:
 *                 type: string
 *                 description: Deposit order ID
 *               action:
 *                 type: string
 *                 enum: [complete, cancel]
 *                 description: Hành động cần thực hiện
 *               tokens:
 *                 type: integer
 *                 description: Số token (nếu action=complete)
 *               note:
 *                 type: string
 *                 description: Ghi chú admin
 *           examples:
 *             complete:
 *               summary: Hoàn thành đơn
 *               value:
 *                 depositId: "dep_abc123"
 *                 action: "complete"
 *                 tokens: 2200000
 *                 note: "Xác nhận chuyển khoản thủ công"
 *             cancel:
 *               summary: Hủy đơn
 *               value:
 *                 depositId: "dep_xyz789"
 *                 action: "cancel"
 *                 note: "User yêu cầu hủy"
 *
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deposit:
 *                   $ref: '#/components/schemas/DepositOrder'
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
 *         description: Đơn không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
depositRoutes.post("/admin/tokens", adminMiddleware, adminUpdateTokens);

export default depositRoutes;
