/**
 * Cron Routes
 * ===========
 * API endpoints quản lý cronjobs
 *
 * Module này cho phép:
 * - Tạo và quản lý scheduled tasks
 * - Theo dõi lịch sử chạy
 * - Chạy thủ công cronjobs
 *
 * **Schedule format:** Standard cron expression (5-field)
 * - `* * * * *` = mỗi phút
 * - `0 9 * * *` = 9h sáng mỗi ngày
 * - `0 0 * * 0` = 0h đêm Chủ nhật
 * - `0/5 * * * *` = mỗi 5 phút
 *
 * **Hoạt động:**
 * - Cronjob gửi task đến user's gateway
 * - Gateway thực thi và trả kết quả
 * - Kết quả được lưu trong execution history
 */

import { Router } from "express";
import { cronController } from "../controllers/cron.controller.js";
import { authMiddleware, adminMiddleware, asyncHandler } from "../middleware/index.js";

const router = Router();

// All routes require auth
router.use(authMiddleware);

// =============================================================================
// UTILITY ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /cron/validate:
 *   post:
 *     tags: [Cron]
 *     summary: Validate cron schedule
 *     description: |
 *       Kiểm tra cron expression có hợp lệ không và tính thời gian chạy tiếp theo.
 *
 *       **Cron format (5 fields):**
 *       ```
 *       ┌───────────── minute (0-59)
 *       │ ┌───────────── hour (0-23)
 *       │ │ ┌───────────── day of month (1-31)
 *       │ │ │ ┌───────────── month (1-12)
 *       │ │ │ │ ┌───────────── day of week (0-6, 0=Sunday)
 *       │ │ │ │ │
 *       * * * * *
 *       ```
 *
 *       **Ví dụ:**
 *       - `0 9 * * *` → 9:00 sáng mỗi ngày
 *       - `0 9 * * 1-5` → 9:00 sáng các ngày trong tuần
 *       - `0/15 * * * *` → Mỗi 15 phút
 *       - `0 0 1 * *` → Đầu mỗi tháng
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schedule
 *             properties:
 *               schedule:
 *                 type: string
 *                 description: Cron expression
 *           examples:
 *             daily:
 *               summary: Mỗi ngày lúc 9h
 *               value:
 *                 schedule: "0 9 * * *"
 *             hourly:
 *               summary: Mỗi giờ
 *               value:
 *                 schedule: "0 * * * *"
 *             invalid:
 *               summary: Invalid expression
 *               value:
 *                 schedule: "invalid"
 *
 *     responses:
 *       200:
 *         description: Kết quả validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScheduleValidation'
 *             examples:
 *               valid:
 *                 summary: Schedule hợp lệ
 *                 value:
 *                   valid: true
 *                   nextRun: "2024-03-21T09:00:00Z"
 *               invalid:
 *                 summary: Schedule không hợp lệ
 *                 value:
 *                   valid: false
 *                   nextRun: null
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
router.post(
  "/validate",
  asyncHandler((req, res) => cronController.validate(req, res)),
);

// =============================================================================
// CRUD ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /cron:
 *   get:
 *     tags: [Cron]
 *     summary: Danh sách cronjobs
 *     description: |
 *       Lấy danh sách tất cả cronjobs của user hiện tại.
 *
 *       **Hỗ trợ filter:**
 *       - `enabled`: Filter theo trạng thái enabled/disabled
 *       - `boxId`: Filter theo box (nếu có)
 *
 *     parameters:
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: Filter theo trạng thái enabled
 *
 *       - in: query
 *         name: boxId
 *         schema:
 *           type: string
 *         description: Filter theo Box ID
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Số cronjobs mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Số cronjobs bỏ qua
 *
 *     responses:
 *       200:
 *         description: Danh sách cronjobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cronjobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cronjob'
 *                 total:
 *                   type: integer
 *             example:
 *               cronjobs:
 *                 - id: "cron_abc123"
 *                   name: "Daily Report"
 *                   schedule: "0 9 * * *"
 *                   action: "Generate daily sales report"
 *                   enabled: true
 *                   nextRunAt: "2024-03-21T09:00:00Z"
 *                   lastRunAt: "2024-03-20T09:00:00Z"
 *                   lastStatus: "success"
 *                   createdAt: "2024-01-15T10:00:00Z"
 *                 - id: "cron_def456"
 *                   name: "Cleanup"
 *                   schedule: "0 0 * * 0"
 *                   action: "Clean up old files"
 *                   enabled: false
 *                   nextRunAt: null
 *                   lastRunAt: "2024-03-17T00:00:00Z"
 *                   lastStatus: "failure"
 *                   createdAt: "2024-02-01T14:30:00Z"
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
  asyncHandler((req, res) => cronController.list(req, res)),
);

/**
 * @swagger
 * /cron:
 *   post:
 *     tags: [Cron]
 *     summary: Tạo cronjob mới
 *     description: |
 *       Tạo một cronjob mới.
 *
 *       **Lưu ý:**
 *       - Schedule phải là cron expression hợp lệ
 *       - Cronjob được enabled mặc định
 *       - `action` hoặc `task` là nội dung gửi đến gateway
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - schedule
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên cronjob
 *               schedule:
 *                 type: string
 *                 description: Cron expression
 *               action:
 *                 type: string
 *                 description: Action/task gửi đến gateway
 *               task:
 *                 type: string
 *                 description: Alias của action
 *               enabled:
 *                 type: boolean
 *                 default: true
 *                 description: Trạng thái enabled
 *               box_id:
 *                 type: string
 *                 description: Box ID (optional)
 *               metadata:
 *                 type: object
 *                 description: Custom metadata
 *           examples:
 *             dailyReport:
 *               summary: Báo cáo hàng ngày
 *               value:
 *                 name: "Daily Report"
 *                 schedule: "0 9 * * *"
 *                 action: "Generate daily sales report and send to email"
 *             weeklyCleanup:
 *               summary: Dọn dẹp hàng tuần
 *               value:
 *                 name: "Weekly Cleanup"
 *                 schedule: "0 0 * * 0"
 *                 task: "Clean up temporary files older than 7 days"
 *                 enabled: true
 *
 *     responses:
 *       201:
 *         description: Tạo cronjob thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cronjob'
 *             example:
 *               id: "cron_new123"
 *               name: "Daily Report"
 *               schedule: "0 9 * * *"
 *               action: "Generate daily sales report"
 *               enabled: true
 *               nextRunAt: "2024-03-21T09:00:00Z"
 *               createdAt: "2024-03-20T15:00:00Z"
 *
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalidSchedule:
 *                 summary: Schedule không hợp lệ
 *                 value:
 *                   error: "Invalid cron schedule format"
 *                   code: "BAD_REQUEST"
 *               missingName:
 *                 summary: Thiếu tên
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "name"
 *                     message: "Name là bắt buộc"
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
router.post(
  "/",
  asyncHandler((req, res) => cronController.create(req, res)),
);

// =============================================================================
// ADMIN ENDPOINTS (must be before /:id to avoid route conflicts)
// =============================================================================

/**
 * @swagger
 * /cron/scheduler/status:
 *   get:
 *     tags: [Cron]
 *     summary: "[Admin] Trạng thái scheduler"
 *     description: Lấy trạng thái của cron scheduler.
 *     responses:
 *       200:
 *         description: Trạng thái scheduler
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/scheduler/status",
  adminMiddleware,
  asyncHandler((req, res) => cronController.schedulerStatus(req, res)),
);

/**
 * @swagger
 * /cron/admin/all:
 *   get:
 *     tags: [Cron]
 *     summary: "[Admin] Danh sách tất cả cronjobs"
 *     description: Lấy danh sách tất cả cronjobs của tất cả users.
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/admin/all",
  adminMiddleware,
  asyncHandler((req, res) => cronController.listAll(req, res)),
);

// =============================================================================
// SINGLE CRONJOB ENDPOINTS (/:id routes)
// =============================================================================

/**
 * @swagger
 * /cron/{id}:
 *   get:
 *     tags: [Cron]
 *     summary: Chi tiết cronjob
 *     description: |
 *       Lấy thông tin chi tiết của một cronjob.
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Cronjob ID
 *
 *     responses:
 *       200:
 *         description: Chi tiết cronjob
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cronjob'
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền truy cập cronjob này
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Cronjob không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/:id",
  asyncHandler((req, res) => cronController.get(req, res)),
);

/**
 * @swagger
 * /cron/{id}:
 *   patch:
 *     tags: [Cron]
 *     summary: Cập nhật cronjob
 *     description: |
 *       Cập nhật thông tin cronjob.
 *
 *       **Có thể cập nhật:**
 *       - `name`: Tên cronjob
 *       - `schedule`: Cron expression
 *       - `action`/`task`: Nội dung task
 *       - `enabled`: Bật/tắt
 *       - `metadata`: Custom data
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Cronjob ID
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
 *               schedule:
 *                 type: string
 *               action:
 *                 type: string
 *               task:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               metadata:
 *                 type: object
 *           examples:
 *             updateSchedule:
 *               summary: Đổi schedule
 *               value:
 *                 schedule: "0 10 * * *"
 *             updateTask:
 *               summary: Đổi task
 *               value:
 *                 action: "Generate weekly report instead"
 *
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cronjob'
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
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Cronjob không tồn tại
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
  asyncHandler((req, res) => cronController.update(req, res)),
);

/**
 * @swagger
 * /cron/{id}:
 *   delete:
 *     tags: [Cron]
 *     summary: Xóa cronjob
 *     description: |
 *       Xóa vĩnh viễn một cronjob.
 *
 *       ⚠️ **Cảnh báo:**
 *       - Thao tác KHÔNG THỂ hoàn tác
 *       - Lịch sử executions cũng bị xóa
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Cronjob ID
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
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Cronjob không tồn tại
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
  asyncHandler((req, res) => cronController.delete(req, res)),
);

// =============================================================================
// ACTION ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /cron/{id}/toggle:
 *   post:
 *     tags: [Cron]
 *     summary: Bật/tắt cronjob
 *     description: |
 *       Enable hoặc disable cronjob.
 *
 *       **Khi disable:**
 *       - Cronjob không được chạy tự động
 *       - Vẫn có thể chạy thủ công
 *
 *       **Khi enable:**
 *       - Cronjob chạy theo schedule
 *       - Next run được tính toán lại
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Cronjob ID
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Trạng thái mới
 *           examples:
 *             enable:
 *               summary: Bật cronjob
 *               value:
 *                 enabled: true
 *             disable:
 *               summary: Tắt cronjob
 *               value:
 *                 enabled: false
 *
 *     responses:
 *       200:
 *         description: Toggle thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cronjob'
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Cronjob không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/:id/toggle",
  asyncHandler((req, res) => cronController.toggle(req, res)),
);

/**
 * @swagger
 * /cron/{id}/run:
 *   post:
 *     tags: [Cron]
 *     summary: Chạy cronjob ngay
 *     description: |
 *       Trigger chạy cronjob ngay lập tức (không đợi schedule).
 *
 *       **Hoạt động:**
 *       1. Gửi task đến user's gateway
 *       2. Đợi gateway xử lý (timeout 2 phút)
 *       3. Lưu kết quả vào execution history
 *       4. Trả về kết quả
 *
 *       **Lưu ý:**
 *       - Chạy bất kể enabled hay disabled
 *       - Không ảnh hưởng đến schedule tiếp theo
 *       - Yêu cầu gateway đang hoạt động
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Cronjob ID
 *
 *     responses:
 *       200:
 *         description: Execution result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CronjobExecution'
 *             example:
 *               id: "exec_xyz789"
 *               cronjobId: "cron_abc123"
 *               status: "success"
 *               output: "Report generated successfully. Sent to 3 recipients."
 *               startedAt: "2024-03-20T15:30:00Z"
 *               completedAt: "2024-03-20T15:30:15Z"
 *               duration: 15000
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Cronjob không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       502:
 *         description: Gateway error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Gateway không phản hồi"
 *               code: "GATEWAY_ERROR"
 *
 *       504:
 *         description: Timeout
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Execution timeout sau 2 phút"
 *               code: "TIMEOUT"
 *
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/:id/run",
  asyncHandler((req, res) => cronController.run(req, res)),
);

/**
 * @swagger
 * /cron/{id}/executions:
 *   get:
 *     tags: [Cron]
 *     summary: Lịch sử chạy cronjob
 *     description: |
 *       Lấy lịch sử các lần chạy của cronjob.
 *
 *       **Thông tin mỗi execution:**
 *       - Trạng thái (success/failure)
 *       - Output hoặc error message
 *       - Thời gian bắt đầu và kết thúc
 *       - Duration
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Cronjob ID
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số executions mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Số executions bỏ qua
 *
 *     responses:
 *       200:
 *         description: Lịch sử executions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 executions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CronjobExecution'
 *                 total:
 *                   type: integer
 *             example:
 *               executions:
 *                 - id: "exec_001"
 *                   status: "success"
 *                   output: "Completed successfully"
 *                   startedAt: "2024-03-20T09:00:00Z"
 *                   completedAt: "2024-03-20T09:00:12Z"
 *                   duration: 12000
 *                 - id: "exec_002"
 *                   status: "failure"
 *                   error: "Gateway timeout"
 *                   startedAt: "2024-03-19T09:00:00Z"
 *                   completedAt: "2024-03-19T09:02:00Z"
 *                   duration: 120000
 *               total: 45
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Cronjob không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/:id/executions",
  asyncHandler((req, res) => cronController.executions(req, res)),
);

export default router;
