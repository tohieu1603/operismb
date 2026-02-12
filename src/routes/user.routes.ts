/**
 * User Routes (Admin Only)
 * ========================
 * Quản lý người dùng trong hệ thống
 *
 * Module này dành cho Admin:
 * - Xem danh sách users
 * - Xem chi tiết user
 * - Cập nhật thông tin user
 * - Xóa user
 * - Nạp token cho user
 *
 * ⚠️ Tất cả endpoints yêu cầu quyền Admin
 */

import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// All routes require auth + admin
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Danh sách users
 *     description: |
 *       Lấy danh sách tất cả users trong hệ thống.
 *
 *       **Chỉ Admin mới có quyền truy cập.**
 *
 *       **Hỗ trợ pagination và filter:**
 *       - `page`: Trang hiện tại (mặc định: 1)
 *       - `limit`: Số lượng mỗi trang (mặc định: 20, tối đa: 100)
 *       - `search`: Tìm theo email hoặc name
 *       - `role`: Filter theo role (user/admin)
 *       - `sortBy`: Sắp xếp theo field (createdAt, name, email)
 *       - `sortOrder`: Thứ tự sắp xếp (asc/desc)
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang (bắt đầu từ 1)
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số lượng users mỗi trang
 *
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo email hoặc tên
 *
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin]
 *         description: Lọc theo role
 *
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, name, email, tokenBalance]
 *           default: createdAt
 *         description: Field để sắp xếp
 *
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *
 *     responses:
 *       200:
 *         description: Danh sách users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserList'
 *             example:
 *               data:
 *                 - id: "usr_abc123"
 *                   email: "user1@example.com"
 *                   name: "User One"
 *                   role: "user"
 *                   tokenBalance: 500000
 *                   createdAt: "2024-01-15T10:30:00Z"
 *                 - id: "usr_def456"
 *                   email: "admin@example.com"
 *                   name: "Admin"
 *                   role: "admin"
 *                   tokenBalance: 10000000
 *                   createdAt: "2024-01-01T00:00:00Z"
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 150
 *                 totalPages: 8
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
router.get(
  "/",
  asyncHandler((req, res) => userController.list(req, res)),
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Chi tiết user
 *     description: |
 *       Lấy thông tin chi tiết của một user theo ID.
 *
 *       **Chỉ Admin mới có quyền truy cập.**
 *
 *       **Thông tin trả về:**
 *       - Thông tin cơ bản: id, email, name
 *       - Role và permissions
 *       - Số dư token
 *       - Lịch sử hoạt động gần đây
 *       - Thống kê sử dụng
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *         example: "usr_abc123"
 *
 *     responses:
 *       200:
 *         description: Thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *             example:
 *               id: "usr_abc123"
 *               email: "user@example.com"
 *               name: "Nguyen Van A"
 *               role: "user"
 *               tokenBalance: 1500000
 *               totalDeposited: 5000000
 *               totalSpent: 3500000
 *               apiKeysCount: 3
 *               conversationsCount: 45
 *               lastActiveAt: "2024-03-20T14:45:00Z"
 *               createdAt: "2024-01-15T10:30:00Z"
 *               updatedAt: "2024-03-20T14:45:00Z"
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
 *             example:
 *               error: "User không tồn tại"
 *               code: "NOT_FOUND"
 *
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/:id",
  asyncHandler((req, res) => userController.getById(req, res)),
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Cập nhật user
 *     description: |
 *       Cập nhật thông tin của user.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Các field có thể cập nhật:**
 *       - `name`: Tên hiển thị
 *       - `role`: Thay đổi role (user/admin)
 *       - `isActive`: Enable/disable user
 *       - `metadata`: Custom metadata
 *
 *       **Không thể cập nhật:**
 *       - `email`: Immutable sau khi tạo
 *       - `password`: Dùng endpoint riêng
 *       - `tokenBalance`: Dùng endpoint topup
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 description: Role mới
 *               isActive:
 *                 type: boolean
 *                 description: Trạng thái active
 *               metadata:
 *                 type: object
 *                 description: Custom metadata
 *           examples:
 *             updateName:
 *               summary: Đổi tên
 *               value:
 *                 name: "Nguyen Van B"
 *             promoteAdmin:
 *               summary: Nâng cấp lên Admin
 *               value:
 *                 role: "admin"
 *             disableUser:
 *               summary: Vô hiệu hóa user
 *               value:
 *                 isActive: false
 *
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
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
router.patch(
  "/:id",
  asyncHandler((req, res) => userController.update(req, res)),
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Xóa user
 *     description: |
 *       Xóa user khỏi hệ thống.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       ⚠️ **Cảnh báo:**
 *       - Thao tác này KHÔNG THỂ hoàn tác
 *       - Tất cả dữ liệu liên quan sẽ bị xóa:
 *         - API keys
 *         - Conversations
 *         - Token transactions
 *         - Deposit orders
 *
 *       **Không thể xóa:**
 *       - Chính mình (Admin đang đăng nhập)
 *       - Admin cuối cùng trong hệ thống
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID cần xóa
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
 *         description: Không có quyền hoặc không thể xóa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               forbidden:
 *                 summary: Không có quyền Admin
 *                 value:
 *                   error: "Yêu cầu quyền Admin"
 *                   code: "FORBIDDEN"
 *               cannotDeleteSelf:
 *                 summary: Không thể xóa chính mình
 *                 value:
 *                   error: "Không thể xóa tài khoản của chính mình"
 *                   code: "CANNOT_DELETE_SELF"
 *               lastAdmin:
 *                 summary: Admin cuối cùng
 *                 value:
 *                   error: "Không thể xóa Admin cuối cùng"
 *                   code: "LAST_ADMIN"
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
router.delete(
  "/:id",
  asyncHandler((req, res) => userController.delete(req, res)),
);

/**
 * @swagger
 * /users/{id}/topup:
 *   post:
 *     tags: [Users]
 *     summary: Nạp token cho user
 *     description: |
 *       Admin nạp token trực tiếp cho user.
 *
 *       **Chỉ Admin mới có quyền.**
 *
 *       **Use cases:**
 *       - Nạp token thủ công cho user VIP
 *       - Hoàn tiền/bồi thường
 *       - Tặng token khuyến mãi
 *       - Xử lý các case đặc biệt
 *
 *       **Lưu ý:**
 *       - Số token phải là số dương
 *       - Transaction được ghi log đầy đủ
 *       - Có thể thêm note để giải thích lý do
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Số token cần nạp
 *               note:
 *                 type: string
 *                 description: Ghi chú lý do nạp
 *           examples:
 *             basicTopup:
 *               summary: Nạp token cơ bản
 *               value:
 *                 amount: 1000000
 *             topupWithNote:
 *               summary: Nạp kèm ghi chú
 *               value:
 *                 amount: 500000
 *                 note: "Hoàn tiền do lỗi hệ thống ngày 20/03"
 *
 *     responses:
 *       200:
 *         description: Nạp token thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 transaction:
 *                   $ref: '#/components/schemas/TokenTransaction'
 *                 message:
 *                   type: string
 *                   example: "Đã nạp 1,000,000 tokens cho user"
 *
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             example:
 *               error: "Validation failed"
 *               code: "VALIDATION_ERROR"
 *               details:
 *                 field: "amount"
 *                 message: "Số token phải lớn hơn 0"
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
  "/:id/topup",
  asyncHandler((req, res) => userController.topup(req, res)),
);

export default router;
