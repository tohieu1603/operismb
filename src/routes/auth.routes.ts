/**
 * Auth Routes
 * ============
 * Authentication và Authorization endpoints
 *
 * Module này xử lý:
 * - Đăng ký tài khoản mới
 * - Đăng nhập và lấy JWT token
 * - Refresh token khi hết hạn
 * - Đăng xuất
 * - Lấy thông tin user hiện tại
 */

import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authMiddleware, optionalAuthMiddleware, asyncHandler } from "../middleware/index.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { validateRegister, validateLogin, validateRefresh } from "../validators/auth.validator.js";

const router = Router();

// =============================================================================
// PUBLIC ROUTES - Không yêu cầu authentication
// =============================================================================

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng ký tài khoản mới
 *     description: |
 *       Tạo tài khoản user mới trong hệ thống.
 *
 *       **Quy tắc validation:**
 *       - Email phải hợp lệ và chưa tồn tại
 *       - Password tối thiểu 8 ký tự
 *       - Name không được để trống
 *
 *       **Sau khi đăng ký thành công:**
 *       - User được tạo với role `user` (mặc định)
 *       - Số dư token ban đầu là 0
 *       - Có thể đăng nhập ngay
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             basic:
 *               summary: Đăng ký cơ bản
 *               value:
 *                 email: "user@example.com"
 *                 password: "SecurePass123!"
 *                 name: "Nguyen Van A"
 *
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *                   example: "Đăng ký thành công"
 *
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalidEmail:
 *                 summary: Email không hợp lệ
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "email"
 *                     message: "Email không hợp lệ"
 *
 *       409:
 *         description: Email đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Email đã được sử dụng"
 *               code: "EMAIL_EXISTS"
 *
 *     security: []
 */
router.post(
  "/register",
  validateBody(validateRegister),
  asyncHandler((req, res) => authController.register(req, res)),
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập
 *     description: |
 *       Xác thực user và trả về JWT tokens.
 *
 *       **Token lifecycle:**
 *       - `accessToken`: Dùng để gọi API, hết hạn sau 24 giờ
 *       - `refreshToken`: Dùng để gia hạn accessToken, hết hạn sau 7 ngày
 *
 *       **Cách sử dụng accessToken:**
 *       ```
 *       Authorization: Bearer <accessToken>
 *       ```
 *
 *       **Khi accessToken hết hạn:**
 *       1. Gọi `POST /auth/refresh` với refreshToken
 *       2. Nhận accessToken mới
 *       3. Tiếp tục sử dụng API
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             basic:
 *               summary: Đăng nhập cơ bản
 *               value:
 *                 email: "user@example.com"
 *                 password: "SecurePass123!"
 *
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               expiresIn: 86400
 *               user:
 *                 id: "usr_abc123"
 *                 email: "user@example.com"
 *                 name: "Nguyen Van A"
 *                 role: "user"
 *
 *       400:
 *         description: Thiếu thông tin đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *
 *       401:
 *         description: Email hoặc mật khẩu không đúng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Email hoặc mật khẩu không đúng"
 *               code: "INVALID_CREDENTIALS"
 *
 *       429:
 *         description: Quá nhiều lần đăng nhập thất bại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Quá nhiều lần thử. Vui lòng đợi 15 phút"
 *               code: "TOO_MANY_ATTEMPTS"
 *
 *     security: []
 */
router.post(
  "/login",
  validateBody(validateLogin),
  asyncHandler((req, res) => authController.login(req, res)),
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Gia hạn access token
 *     description: |
 *       Sử dụng refresh token để lấy access token mới.
 *
 *       **Khi nào cần gọi:**
 *       - Khi accessToken hết hạn (nhận HTTP 401)
 *       - Proactively trước khi token hết hạn
 *
 *       **Lưu ý:**
 *       - Mỗi refreshToken chỉ dùng được 1 lần
 *       - Sau khi refresh, refreshToken cũ bị vô hiệu hóa
 *       - Response trả về cả accessToken và refreshToken mới
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *
 *     responses:
 *       200:
 *         description: Refresh thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *
 *       400:
 *         description: Thiếu refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *
 *       401:
 *         description: Refresh token không hợp lệ hoặc đã hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Refresh token không hợp lệ hoặc đã hết hạn"
 *               code: "INVALID_REFRESH_TOKEN"
 *
 *     security: []
 */
router.post(
  "/refresh",
  validateBody(validateRefresh),
  asyncHandler((req, res) => authController.refresh(req, res)),
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng xuất
 *     description: |
 *       Đăng xuất và vô hiệu hóa token hiện tại.
 *
 *       **Hoạt động:**
 *       - Vô hiệu hóa refresh token (nếu có trong request)
 *       - Client nên xóa token khỏi storage
 *
 *       **Lưu ý:**
 *       - Endpoint này luôn trả về success
 *       - Không yêu cầu authentication (để handle case token đã hết hạn)
 *
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token cần vô hiệu hóa (optional)
 *
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Đăng xuất thành công"
 *
 *     security: []
 */
router.post(
  "/logout",
  optionalAuthMiddleware,
  asyncHandler((req, res) => authController.logout(req, res)),
);

// =============================================================================
// PROTECTED ROUTES - Yêu cầu JWT authentication
// =============================================================================

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin user hiện tại
 *     description: |
 *       Trả về thông tin chi tiết của user đang đăng nhập.
 *
 *       **Thông tin trả về:**
 *       - Thông tin cơ bản: id, email, name
 *       - Role và permissions
 *       - Số dư token hiện tại
 *       - Thời gian tạo và cập nhật
 *
 *       **Use cases:**
 *       - Hiển thị profile user
 *       - Check role/permissions
 *       - Verify token còn valid
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
 *               createdAt: "2024-01-15T10:30:00Z"
 *               updatedAt: "2024-03-20T14:45:00Z"
 *
 *       401:
 *         description: Chưa đăng nhập hoặc token hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Token không hợp lệ hoặc đã hết hạn"
 *               code: "UNAUTHORIZED"
 *
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/me",
  authMiddleware,
  asyncHandler((req, res) => authController.getMe(req, res)),
);

/**
 * @swagger
 * /auth/me/gateway:
 *   patch:
 *     tags: [Auth]
 *     summary: Cập nhật gateway configuration
 *     description: |
 *       User tự cập nhật gateway_url và gateway_token của mình.
 *
 *       **Use case:** Sau khi đăng nhập, frontend gọi endpoint này
 *       để cấu hình gateway cho user.
 *
 *       **Gửi `null` để xóa giá trị hiện tại.**
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gateway_url:
 *                 type: string
 *                 nullable: true
 *                 description: URL của Moltbot gateway
 *                 example: "http://localhost:18789"
 *               gateway_token:
 *                 type: string
 *                 nullable: true
 *                 description: Authentication token cho gateway
 *                 example: "gw_abc123xyz"
 *           examples:
 *             updateBoth:
 *               summary: Cập nhật cả URL và token
 *               value:
 *                 gateway_url: "http://localhost:18789"
 *                 gateway_token: "gw_abc123xyz"
 *             updateTokenOnly:
 *               summary: Chỉ cập nhật token
 *               value:
 *                 gateway_token: "gw_new_token_456"
 *             clearGateway:
 *               summary: Xóa cấu hình gateway
 *               value:
 *                 gateway_url: null
 *                 gateway_token: null
 *
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *
 *       401:
 *         description: Chưa đăng nhập hoặc token hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/me/gateway",
  authMiddleware,
  asyncHandler((req, res) => authController.updateGateway(req, res)),
);

export default router;
