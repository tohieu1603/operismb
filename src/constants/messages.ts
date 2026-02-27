/**
 * Centralized message constants for operis-api
 *
 * Rules:
 * - User-facing messages (MSG): Vietnamese, security-safe (never reveal specific cause)
 * - Server log messages (LOG): English, detailed for debugging
 * - Use MSG.* in HTTP responses / ApiError / validators
 * - Use LOG.* in console.error / console.warn
 */

// ─── User-facing messages (Vietnamese, security-safe) ───────────────────────

export const MSG = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  AUTH_REQUIRED: "Yêu cầu đăng nhập",
  INVALID_CREDENTIALS: "Tài khoản hoặc mật khẩu không đúng",
  INVALID_TOKEN: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
  TOKEN_EXPIRED: "Phiên đăng nhập đã hết hạn",
  ACCOUNT_DEACTIVATED: "Tài khoản đã bị vô hiệu hóa",
  ACCESS_DENIED: "Truy cập bị từ chối",
  AUTH_FAILED: "Xác thực thất bại",
  REGISTRATION_FAILED: "Đăng ký thất bại",
  INVALID_WEBHOOK_KEY: "Khóa webhook không hợp lệ",
  UNAUTHORIZED: "Không có quyền truy cập",

  // ── Rate limiting ────────────────────────────────────────────────────────
  RATE_LIMIT_LOGIN: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.",
  RATE_LIMIT_REGISTER: "Quá nhiều lần đăng ký. Vui lòng thử lại sau.",
  RATE_LIMIT_PASSWORD: "Quá nhiều lần đổi mật khẩu. Vui lòng thử lại sau.",
  RATE_LIMIT_GENERAL: "Quá nhiều yêu cầu. Vui lòng chậm lại.",

  // ── Resource not found ───────────────────────────────────────────────────
  NOT_FOUND: (resource: string) => `Không tìm thấy ${resource}`,
  USER_NOT_FOUND: "Không tìm thấy người dùng",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng",
  PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm",
  REVIEW_NOT_FOUND: "Không tìm thấy đánh giá",
  QUESTION_NOT_FOUND: "Không tìm thấy câu hỏi",
  CRONJOB_NOT_FOUND: "Không tìm thấy tác vụ định kỳ",
  DEPOSIT_NOT_FOUND: "Không tìm thấy lệnh nạp tiền",
  API_KEY_NOT_FOUND: "Không tìm thấy API key",
  SESSION_NOT_FOUND: "Phiên làm việc không tồn tại hoặc đã hết hạn",

  // ── Conflict ─────────────────────────────────────────────────────────────
  EMAIL_EXISTS: "Email đã được sử dụng",
  MACHINE_ID_EXISTS: "Mã thiết bị đã được sử dụng",
  SLUG_EXISTS: "Slug sản phẩm đã tồn tại",
  DUPLICATE_REVIEW: "Bạn đã đánh giá sản phẩm này rồi",
  DUPLICATE_PACKAGE_ID: "Mã gói nạp không được trùng nhau",

  // ── Validation: common ───────────────────────────────────────────────────
  INVALID_REQUEST: "Dữ liệu yêu cầu không hợp lệ",
  REQUEST_BODY_REQUIRED: "Thiếu dữ liệu yêu cầu",
  NO_FIELDS_TO_UPDATE: "Không có trường nào để cập nhật",

  // ── Validation: auth fields ──────────────────────────────────────────────
  EMAIL_REQUIRED: "Email là bắt buộc",
  EMAIL_INVALID: "Email không đúng định dạng",
  PASSWORD_REQUIRED: "Mật khẩu là bắt buộc",
  PASSWORD_MIN_LENGTH: "Mật khẩu phải có ít nhất 8 ký tự",
  NAME_REQUIRED: "Tên là bắt buộc",
  NAME_LENGTH: "Tên phải từ 2 đến 100 ký tự",
  ROLE_INVALID: "Vai trò phải là 'admin' hoặc 'user'",
  TOKEN_BALANCE_INVALID: "Số dư token phải là số không âm",
  UNIQUE_MACHINE_INVALID: "Mã thiết bị phải là chuỗi (tối đa 255 ký tự)",
  IS_ACTIVE_INVALID: "is_active phải là boolean",
  REFRESH_TOKEN_REQUIRED: "Refresh token là bắt buộc",
  CURRENT_PASSWORD_REQUIRED: "Mật khẩu hiện tại là bắt buộc",
  NEW_PASSWORD_REQUIRED: "Mật khẩu mới là bắt buộc",
  NEW_PASSWORD_MIN_LENGTH: "Mật khẩu mới phải có ít nhất 8 ký tự",

  // ── Validation: common fields ────────────────────────────────────────────
  INVALID_UUID: (field: string) => `${field} không hợp lệ`,
  MUST_BE_POSITIVE: (field: string) => `${field} phải là số dương`,
  FIELD_REQUIRED: (field: string) => `${field} là bắt buộc`,
  FIELD_LENGTH: (field: string, min: number, max: number) =>
    `${field} phải từ ${min} đến ${max} ký tự`,
  INVALID_STRING: "Giá trị chuỗi không hợp lệ",
  INVALID_ENUM: (field: string) => `${field} không hợp lệ`,
  MUST_BE_BOOLEAN: (field: string) => `${field} phải là boolean`,

  // ── Validation: user fields ──────────────────────────────────────────────
  INVALID_USER_ID: "ID người dùng không hợp lệ",
  NAME_MIN_LENGTH: "Tên phải có ít nhất 2 ký tự",
  AMOUNT_MUST_BE_POSITIVE: "Số lượng phải là số dương",

  // ── Validation: chat ─────────────────────────────────────────────────────
  MESSAGE_REQUIRED: "Tin nhắn là bắt buộc",
  CONVERSATION_ID_REQUIRED: "ID cuộc hội thoại là bắt buộc",
  SAVE_HISTORY_FIELDS_REQUIRED: "conversationId, userMessage, assistantMessage là bắt buộc",

  // ── Validation: cron ─────────────────────────────────────────────────────
  CRON_BOX_ID_STRING: "box_id phải là chuỗi",
  CRON_NAME_REQUIRED: "Tên tác vụ là bắt buộc",
  CRON_NAME_LENGTH: "Tên tác vụ phải từ 1 đến 100 ký tự",
  CRON_DESC_STRING: "Mô tả phải là chuỗi",
  CRON_SCHEDULE_TYPE_INVALID: "Loại lịch phải là: cron, every, hoặc at",
  CRON_SCHEDULE_EXPR_REQUIRED: "Biểu thức lịch là bắt buộc",
  CRON_SCHEDULE_EXPR_INVALID: "Định dạng biểu thức cron không hợp lệ",
  CRON_SCHEDULE_TZ_STRING: "Múi giờ phải là chuỗi",
  CRON_INTERVAL_REQUIRED: "schedule_interval_ms là bắt buộc cho loại 'every'",
  CRON_INTERVAL_MIN: "schedule_interval_ms phải ít nhất 1000 (1 giây)",
  CRON_AT_REQUIRED: "schedule_at_ms là bắt buộc cho loại 'at'",
  CRON_AT_FUTURE: "schedule_at_ms phải là thời điểm trong tương lai",
  CRON_ANCHOR_NUMBER: "schedule_anchor_ms phải là số",
  CRON_AGENT_ID_STRING: "agent_id phải là chuỗi",
  CRON_SESSION_TARGET_INVALID: "session_target phải là: main hoặc isolated",
  CRON_WAKE_MODE_INVALID: "wake_mode phải là: next-heartbeat hoặc now",
  CRON_PAYLOAD_KIND_INVALID: "payload_kind phải là: systemEvent hoặc agentTurn",
  CRON_MAIN_REQUIRES_SYSTEM_EVENT: 'session_target="main" yêu cầu payload_kind="systemEvent"',
  CRON_ISOLATED_REQUIRES_AGENT_TURN: 'session_target="isolated" yêu cầu payload_kind="agentTurn"',
  CRON_MESSAGE_REQUIRED: "Nội dung tin nhắn là bắt buộc",
  CRON_MESSAGE_LENGTH: "Nội dung tin nhắn phải từ 1 đến 10000 ký tự",
  CRON_MODEL_STRING: "model phải là chuỗi",
  CRON_THINKING_STRING: "thinking phải là chuỗi",
  CRON_TIMEOUT_NUMBER: "timeout_seconds phải là số",
  CRON_TIMEOUT_RANGE: "timeout_seconds phải từ 1 đến 600",
  CRON_DELIVER_BOOLEAN: "deliver phải là boolean",
  CRON_CHANNEL_STRING: "channel phải là chuỗi",
  CRON_TO_STRING: "to_recipient phải là chuỗi",
  CRON_UNSAFE_BOOLEAN: "allow_unsafe_external_content phải là boolean",
  CRON_BEST_EFFORT_BOOLEAN: "best_effort_deliver phải là boolean",
  CRON_POST_PREFIX_STRING: "isolation_post_to_main_prefix phải là chuỗi",
  CRON_POST_MODE_INVALID: "isolation_post_to_main_mode phải là: summary hoặc full",
  CRON_POST_MAX_CHARS_NUMBER: "isolation_post_to_main_max_chars phải là số",
  CRON_POST_MAX_CHARS_RANGE: "isolation_post_to_main_max_chars phải từ 100 đến 100000",
  CRON_ENABLED_BOOLEAN: "enabled phải là boolean",
  CRON_DELETE_AFTER_RUN_BOOLEAN: "delete_after_run phải là boolean",
  CRON_METADATA_OBJECT: "metadata phải là object",

  // ── Validation: deposit ──────────────────────────────────────────────────
  INVALID_TIER: (tierId: string) => `Gói nạp không hợp lệ: ${tierId}`,
  TOKEN_OR_TIER_REQUIRED: "tokenAmount hoặc tierId là bắt buộc",
  AMOUNT_VND_REQUIRED: "amountVnd là bắt buộc cho thanh toán đơn hàng",
  INVALID_DEPOSIT_TYPE: "Loại nạp không hợp lệ. Phải là 'token' hoặc 'order'",
  MIN_DEPOSIT_TOKENS: "Số token nạp tối thiểu là 100.000",
  MIN_AMOUNT_VND: "Số tiền tối thiểu là 1.000 VNĐ",
  ONLY_PENDING_CANCEL: "Chỉ có thể hủy lệnh đang chờ xử lý",
  PACKAGES_REQUIRED: "Danh sách gói nạp là bắt buộc",
  PACKAGE_ID_NAME_REQUIRED: "Mỗi gói phải có id và name",
  PACKAGE_PRICE_INVALID: (id: string) => `Gói '${id}': priceVnd phải >= 0`,
  ADMIN_REQUIRED: "Cần quyền quản trị viên",

  // ── Validation: order ────────────────────────────────────────────────────
  CART_EMPTY: "Giỏ hàng trống",
  PRODUCT_SLUG_NOT_FOUND: (slug: string) => `Không tìm thấy sản phẩm ${slug}`,
  INSUFFICIENT_STOCK: (name: string, available: number) =>
    `${name} không đủ hàng (còn: ${available})`,
  NOT_YOUR_ORDER: "Đơn hàng không thuộc về bạn",
  STATUS_REQUIRED: "Trạng thái là bắt buộc",
  INVALID_STATUS: (validStatuses: string) =>
    `Trạng thái không hợp lệ. Phải là: ${validStatuses}`,

  // ── Validation: product ──────────────────────────────────────────────────
  INVALID_CATEGORY: (category: string, valid: string) =>
    `Danh mục '${category}' không hợp lệ. Phải là: ${valid}`,

  // ── Validation: feedback ─────────────────────────────────────────────────
  REPORT_CREATED: "Đã gửi báo cáo thành công",
  REPORT_NOT_FOUND: "Không tìm thấy báo cáo",
  REPORT_UPDATED: "Đã cập nhật trạng thái báo cáo",
  REPORT_SUBJECT_REQUIRED: "Tiêu đề báo cáo là bắt buộc",
  REPORT_CONTENT_REQUIRED: "Nội dung báo cáo là bắt buộc",
  REPORT_TYPE_INVALID: "Loại báo cáo phải là: bug, feedback, hoặc suggestion",
  REPORT_STATUS_INVALID: "Trạng thái phải là: open, in_progress, resolved, hoặc closed",

  // ── Validation: review / question ────────────────────────────────────────
  RATING_RANGE: "Đánh giá phải từ 1 đến 5",
  QUESTION_CONTENT_REQUIRED: "Nội dung câu hỏi là bắt buộc",
  ANSWER_CONTENT_REQUIRED: "Nội dung câu trả lời là bắt buộc",

  // ── Validation: token ────────────────────────────────────────────────────
  USER_ID_REQUIRED: "userId là bắt buộc và phải là chuỗi",
  AMOUNT_POSITIVE: "Số lượng phải là số dương",
  AMOUNT_FINITE: "Số lượng phải là số hữu hạn",
  TOTAL_TOKENS_POSITIVE: "total_tokens phải lớn hơn 0",

  // ── Validation: gateway proxy ────────────────────────────────────────────
  HOOK_NAME_REQUIRED: "hookName là bắt buộc",
  TOOL_REQUIRED: "tool là bắt buộc",
  TEXT_REQUIRED: "text là bắt buộc",
  INPUT_REQUIRED: "input là bắt buộc",
  MESSAGES_REQUIRED: "messages là bắt buộc",

  // ── Validation: zalo ─────────────────────────────────────────────────────
  MISSING_TOKEN_PARAM: "Thiếu tham số token",
  MISSING_USAGE_FIELDS: "Thiếu trường bắt buộc: user_id, input_tokens, output_tokens",
  MISSING_USER_ID_PARAM: "Thiếu tham số user_id",

  // ── Validation: gateway register ─────────────────────────────────────────
  INVALID_REGISTER_SECRET: "Mã đăng ký không hợp lệ",
  REGISTER_EMAIL_REQUIRED: "Email là bắt buộc",

  // ── Validation: token vault ──────────────────────────────────────────────
  TOKENS_ARRAY_REQUIRED: "Danh sách token là bắt buộc (chuỗi không rỗng)",
  NO_TOKENS_STORED: "Không có token nào được lưu trữ",

  // ── Balance ──────────────────────────────────────────────────────────────
  INSUFFICIENT_BALANCE: (current: number, required: number) =>
    `Số dư token không đủ. Hiện tại: ${current}, Cần: ${required}`,

  // ── Service errors ───────────────────────────────────────────────────────
  SERVICE_UNAVAILABLE: (service: string) => `Dịch vụ ${service} tạm thời không khả dụng`,
  INTERNAL_ERROR: "Đã xảy ra lỗi hệ thống",
  GATEWAY_NOT_CONFIGURED: "Gateway chưa được cấu hình",
  GATEWAY_ERROR: "Lỗi kết nối gateway",
  GATEWAY_TIMEOUT: "Gateway không phản hồi",
  NO_RESPONSE_BODY: "Không có dữ liệu phản hồi",

  // ── Anthropic proxy ──────────────────────────────────────────────────────
  INVALID_API_KEY: "API key không hợp lệ",
  NO_ANTHROPIC_TOKEN: "Không có Anthropic token khả dụng",
} as const;

// ─── Server log messages (English, detailed) ────────────────────────────────

export const LOG = {
  // Auth
  AUTH_LOGIN_NOT_FOUND: (email: string) => `[auth] Login failed: user not found (email=${email})`,
  AUTH_LOGIN_DEACTIVATED: (email: string) => `[auth] Login failed: account deactivated (email=${email})`,
  AUTH_LOGIN_WRONG_PASSWORD: (email: string) => `[auth] Login failed: password mismatch (email=${email})`,
  AUTH_REGISTER_DUPLICATE: (email: string) => `[auth] Registration failed: email already exists (email=${email})`,
  AUTH_TOKEN_INVALID: (reason: string) => `[auth] Token verification failed: ${reason}`,
  AUTH_TOKEN_EXPIRED: (userId: string) => `[auth] Token expired for user=${userId}`,
  AUTH_CHANGE_PASSWORD_WRONG: (userId: string) => `[auth] Change password failed: current password mismatch (userId=${userId})`,

  // Resource
  RESOURCE_NOT_FOUND: (resource: string, id: string) => `[api] ${resource} not found (id=${id})`,

  // Balance
  INSUFFICIENT_BALANCE: (userId: string, current: number, required: number) =>
    `[token] Insufficient balance: userId=${userId} current=${current} required=${required}`,

  // Gateway
  GATEWAY_ERROR: (status: number, body: string) => `[gateway] HTTP error: status=${status} body=${body}`,
  GATEWAY_TIMEOUT: (url: string) => `[gateway] Request timeout: url=${url}`,
  GATEWAY_NOT_CONFIGURED: (userId: string) => `[gateway] Not configured for userId=${userId}`,
  API_KEY_ERROR: (error: string) => `[gateway] API key error: ${error}`,

  // Webhook
  WEBHOOK_INVALID_KEY: (ip: string) => `[webhook] Invalid key from ip=${ip}`,
  HOST_BLOCKED: (ip: string, host: string, origin: string) =>
    `[api] Blocked request from: ${ip} / ${host} / ${origin}`,

  // Rate limit
  RATE_LIMITED: (ip: string, endpoint: string) => `[rate-limit] Exceeded: ip=${ip} endpoint=${endpoint}`,

  // General error
  ERROR: (name: string, message: string) => `[api] Error [${name}]: ${message}`,
  ERROR_CODE: (code: string, status: number) => `  → Code: ${code} | Status: ${status}`,
  ERROR_STACK: (stack: string) => `  → Stack: ${stack}`,

  // Conflict
  EMAIL_EXISTS: (email: string) => `[auth] Email conflict: ${email}`,
  MACHINE_ID_EXISTS: (machineId: string) => `[auth] Machine ID conflict: ${machineId}`,
} as const;
