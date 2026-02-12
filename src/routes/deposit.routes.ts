/**
 * Deposit Routes
 * ==============
 * Thanh toán qua chuyển khoản ngân hàng (SePay)
 *
 * Hỗ trợ 2 loại:
 * - **token**: Nạp token (prefix OP)
 * - **order**: Thanh toán đơn hàng (prefix OD)
 *
 * **Flow thanh toán:**
 * 1. User gọi POST /deposits tạo đơn (truyền type)
 * 2. User chuyển khoản theo thông tin trả về
 * 3. Hệ thống nhận webhook từ SePay
 * 4. Token deposit → cộng token; Order → đánh dấu hoàn thành
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
import { sepayWebhookMiddleware } from "../middleware/sepay-webhook.middleware.js";

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
 *       2. Tìm đơn theo mã giao dịch (prefix OP = token, OD = order)
 *       3. Cập nhật trạng thái đơn
 *       4. Cộng token cho user nếu đơn nạp token (OP)
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
depositRoutes.post("/webhook/sepay", sepayWebhookMiddleware, sepayWebhook);

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
 *     summary: Tạo đơn thanh toán
 *     description: |
 *       Tạo đơn thanh toán mới. Hỗ trợ 2 loại:
 *
 *       **1. Nạp token (`type: "token"`):**
 *       - Chọn gói từ bảng giá (`tierId`) hoặc nhập số token (`tokenAmount`)
 *       - Token được cộng tự động khi thanh toán thành công
 *
 *       **2. Thanh toán đơn hàng (`type: "order"`):**
 *       - Nhập số tiền VND (`amountVnd`)
 *       - Không cộng token, chỉ đánh dấu đơn hoàn thành
 *
 *       **Lưu ý:**
 *       - Mỗi user có tối đa 1 đơn pending **mỗi loại**
 *       - Đơn pending hết hạn sau 30 phút
 *       - Nội dung chuyển khoản phải ĐÚNG NGUYÊN VĂN
 *       - Không truyền `type` → mặc định `"token"`
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [token, order]
 *                 default: token
 *                 description: Loại thanh toán
 *               tierId:
 *                 type: string
 *                 description: ID gói từ bảng giá (chỉ cho type=token)
 *               tokenAmount:
 *                 type: integer
 *                 description: Số token muốn nạp (chỉ cho type=token)
 *               amountVnd:
 *                 type: integer
 *                 description: Số tiền VND (chỉ cho type=order)
 *           examples:
 *             tokenFromTier:
 *               summary: Nạp token theo gói
 *               value:
 *                 type: "token"
 *                 tierId: "standard"
 *             tokenCustom:
 *               summary: Nạp token tùy chọn
 *               value:
 *                 type: "token"
 *                 tokenAmount: 500000
 *             orderPayment:
 *               summary: Thanh toán đơn hàng
 *               value:
 *                 type: "order"
 *                 amountVnd: 15000000
 *
 *     responses:
 *       201:
 *         description: Đơn thanh toán đã tạo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DepositOrder'
 *             example:
 *               id: "uuid-abc123"
 *               type: "token"
 *               orderCode: "OP1ABC2DEF"
 *               tokenAmount: 500000
 *               amountVnd: 250000
 *               status: "pending"
 *               paymentInfo:
 *                 bankName: "BIDV"
 *                 accountNumber: "96247CISI1"
 *                 accountName: "TO TRONG HIEU"
 *                 transferContent: "OP1ABC2DEF"
 *                 qrCodeUrl: "https://qr.sepay.vn/img?..."
 *               expiresAt: "2024-03-20T15:30:00Z"
 *               createdAt: "2024-03-20T15:00:00Z"
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
 *     security:
 *       - BearerAuth: []
 */
depositRoutes.post("/", createDeposit);

/**
 * @swagger
 * /deposits/pending:
 *   get:
 *     tags: [Deposits]
 *     summary: Đơn đang chờ thanh toán
 *     description: |
 *       Lấy đơn thanh toán đang pending (nếu có).
 *
 *       Mỗi user có tối đa 1 đơn pending **mỗi loại** (token / order).
 *       Truyền `type` để lọc theo loại.
 *
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [token, order]
 *         description: Lọc theo loại (không truyền = tất cả)
 *
 *     responses:
 *       200:
 *         description: Đơn pending (hoặc null)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasPending:
 *                   type: boolean
 *                 order:
 *                   nullable: true
 *                   $ref: '#/components/schemas/DepositOrder'
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
 *     summary: Lịch sử thanh toán
 *     description: |
 *       Lấy lịch sử các đơn thanh toán của user.
 *
 *       **Loại đơn:**
 *       - `token`: Nạp token
 *       - `order`: Thanh toán đơn hàng
 *
 *       **Trạng thái đơn:**
 *       - `pending`: Đang chờ thanh toán
 *       - `completed`: Đã hoàn thành
 *       - `cancelled`: Đã hủy
 *       - `expired`: Hết hạn
 *
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [token, order]
 *         description: Lọc theo loại (không truyền = tất cả)
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
 *         description: Danh sách đơn thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
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
