/**
 * Chat Routes
 * ===========
 * API endpoints để chat với AI models
 *
 * Module này cung cấp:
 * - Chat với AI models (hỗ trợ streaming)
 * - Quản lý conversations
 * - Xem lịch sử chat
 *
 * **Authentication:**
 * - Hỗ trợ cả JWT Token và API Key
 * - Chat endpoints chấp nhận cả 2 phương thức
 * - Conversation management chỉ dùng JWT
 *
 * **Rate limiting:**
 * - 20 requests/minute per user
 */

import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { chatStreamController } from "../controllers/chat-stream.controller";
import { authMiddleware, hybridAuthMiddleware, asyncHandler } from "../middleware/index";

const router = Router();

// =============================================================================
// CHAT ENDPOINTS - Hỗ trợ JWT và API Key
// =============================================================================

/**
 * @swagger
 * /chat:
 *   post:
 *     tags: [Chat]
 *     summary: Gửi tin nhắn đến AI
 *     description: |
 *       Gửi tin nhắn và nhận phản hồi từ AI model.
 *
 *       **Hỗ trợ cả JWT và API Key authentication.**
 *
 *       **Models hỗ trợ:**
 *       - `claude-opus-4-20250514`: Mạnh nhất, phù hợp complex tasks
 *       - `claude-sonnet-4-20250514`: Cân bằng speed/quality
 *       - `claude-haiku-3-20240307`: Nhanh nhất, phù hợp simple tasks
 *
 *       **Tính phí:**
 *       - Tính theo input + output tokens
 *       - Giá khác nhau theo model
 *       - Check `/deposits/pricing` để xem bảng giá
 *
 *       **Conversation:**
 *       - Gửi `conversationId` để tiếp tục conversation
 *       - Không gửi = tạo conversation mới
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *           examples:
 *             simple:
 *               summary: Chat đơn giản
 *               value:
 *                 message: "Xin chào, bạn có thể giúp gì cho tôi?"
 *             withModel:
 *               summary: Chọn model cụ thể
 *               value:
 *                 message: "Giải thích cách hoạt động của neural network"
 *                 model: "claude-opus-4-20250514"
 *             continueConversation:
 *               summary: Tiếp tục conversation
 *               value:
 *                 message: "Có thể giải thích rõ hơn không?"
 *                 conversationId: "conv_abc123"
 *             withSystemPrompt:
 *               summary: Có system prompt
 *               value:
 *                 message: "Write a Python function to sort a list"
 *                 systemPrompt: "You are a helpful coding assistant. Always include comments and follow PEP8."
 *                 model: "claude-sonnet-4-20250514"
 *
 *     responses:
 *       200:
 *         description: Phản hồi từ AI
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *             example:
 *               conversationId: "conv_abc123"
 *               messageId: "msg_xyz789"
 *               response: "Xin chào! Tôi có thể giúp bạn với nhiều việc..."
 *               model: "claude-sonnet-4-20250514"
 *               usage:
 *                 inputTokens: 150
 *                 outputTokens: 280
 *                 totalTokens: 430
 *               cost: 4300
 *               remainingBalance: 1495700
 *
 *       400:
 *         description: Request không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               emptyMessage:
 *                 summary: Tin nhắn trống
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "message"
 *                     message: "Tin nhắn không được để trống"
 *               invalidModel:
 *                 summary: Model không hợp lệ
 *                 value:
 *                   error: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   details:
 *                     field: "model"
 *                     message: "Model không được hỗ trợ"
 *
 *       401:
 *         description: Chưa xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Token hoặc API key không hợp lệ"
 *               code: "UNAUTHORIZED"
 *
 *       402:
 *         description: Không đủ token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Không đủ token. Số dư: 1,000. Cần tối thiểu: 10,000"
 *               code: "INSUFFICIENT_BALANCE"
 *               balance: 1000
 *               required: 10000
 *
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Quá nhiều request. Vui lòng đợi 30 giây"
 *               code: "RATE_LIMIT_EXCEEDED"
 *               retryAfter: 30
 *
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 */
router.post(
  "/",
  asyncHandler(async (req, res, next) => {
    await hybridAuthMiddleware(req, res, next);
  }),
  asyncHandler((req, res) => chatController.sendMessage(req, res)),
);

/**
 * @swagger
 * /chat/stream:
 *   post:
 *     tags: [Chat]
 *     summary: Chat với streaming response
 *     description: |
 *       Gửi tin nhắn và nhận phản hồi streaming qua Server-Sent Events (SSE).
 *
 *       **Hỗ trợ cả JWT và API Key authentication.**
 *
 *       **Streaming format:**
 *       Response là text/event-stream với các events:
 *
 *       ```
 *       event: message_start
 *       data: {"conversationId": "conv_abc123", "model": "claude-sonnet-4-20250514"}
 *
 *       event: content_block_delta
 *       data: {"delta": {"text": "Xin "}}
 *
 *       event: content_block_delta
 *       data: {"delta": {"text": "chào!"}}
 *
 *       event: message_stop
 *       data: {"usage": {"inputTokens": 100, "outputTokens": 50}, "cost": 1500}
 *       ```
 *
 *       **Use cases:**
 *       - Hiển thị phản hồi real-time
 *       - Cải thiện UX cho responses dài
 *       - Tương tác chatbot
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *           example:
 *             message: "Viết một bài thơ về mùa xuân"
 *             model: "claude-sonnet-4-20250514"
 *
 *     responses:
 *       200:
 *         description: Stream response
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream
 *             example: |
 *               event: message_start
 *               data: {"conversationId":"conv_abc","model":"claude-sonnet-4-20250514"}
 *
 *               event: content_block_delta
 *               data: {"delta":{"text":"Mùa xuân "}}
 *
 *               event: content_block_delta
 *               data: {"delta":{"text":"về trên "}}
 *
 *               event: message_stop
 *               data: {"usage":{"inputTokens":50,"outputTokens":200},"cost":2500}
 *
 *       400:
 *         description: Request không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *
 *       401:
 *         description: Chưa xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       402:
 *         description: Không đủ token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 */
router.post(
  "/stream",
  asyncHandler(async (req, res, next) => {
    await hybridAuthMiddleware(req, res, next);
  }),
  asyncHandler((req, res) => chatStreamController.streamMessage(req, res)),
);

// =============================================================================
// PROTECTED ROUTES - Chỉ JWT authentication
// =============================================================================

/**
 * @swagger
 * /chat/balance:
 *   get:
 *     tags: [Chat]
 *     summary: Kiểm tra số dư token
 *     description: |
 *       Quick check số dư token trước khi chat.
 *
 *       **Shortcut cho `/tokens/balance`**
 *
 *       Hữu ích để:
 *       - Check có đủ token để chat không
 *       - Hiển thị số dư trong UI
 *
 *     responses:
 *       200:
 *         description: Số dư token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: integer
 *                   description: Số dư hiện tại
 *                 sufficient:
 *                   type: boolean
 *                   description: Có đủ để chat không (>= 10000)
 *             example:
 *               balance: 1500000
 *               sufficient: true
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
  authMiddleware,
  asyncHandler((req, res) => chatController.getBalance(req, res)),
);

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     tags: [Chat]
 *     summary: Danh sách conversations
 *     description: |
 *       Lấy danh sách tất cả conversations của user.
 *
 *       **Thông tin mỗi conversation:**
 *       - ID và tiêu đề
 *       - Model đang sử dụng
 *       - Số lượng messages
 *       - Tin nhắn cuối cùng (preview)
 *       - Thời gian tạo và cập nhật
 *
 *       **Sắp xếp:**
 *       - Mặc định: conversation mới nhất trước
 *
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số conversations mỗi trang
 *
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Số conversations bỏ qua
 *
 *     responses:
 *       200:
 *         description: Danh sách conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *                 total:
 *                   type: integer
 *             example:
 *               conversations:
 *                 - id: "conv_abc123"
 *                   title: "Hỏi về Python"
 *                   model: "claude-sonnet-4-20250514"
 *                   messageCount: 12
 *                   lastMessage: "Cảm ơn bạn đã giải thích!"
 *                   createdAt: "2024-03-20T10:00:00Z"
 *                   updatedAt: "2024-03-20T14:30:00Z"
 *                 - id: "conv_def456"
 *                   title: "Code review"
 *                   model: "claude-opus-4-20250514"
 *                   messageCount: 8
 *                   lastMessage: "Code looks good!"
 *                   createdAt: "2024-03-19T15:00:00Z"
 *                   updatedAt: "2024-03-19T16:45:00Z"
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
  "/conversations",
  authMiddleware,
  asyncHandler((req, res) => chatController.getConversations(req, res)),
);

/**
 * @swagger
 * /chat/conversations/new:
 *   post:
 *     tags: [Chat]
 *     summary: Tạo conversation mới
 *     description: |
 *       Tạo một conversation mới (trống).
 *
 *       **Use cases:**
 *       - Bắt đầu chủ đề mới
 *       - Tạo trước conversation với settings cụ thể
 *
 *       **Lưu ý:**
 *       - Conversation trống sẽ bị xóa sau 24h nếu không có message
 *       - Có thể set model và system prompt ngay khi tạo
 *
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Tiêu đề conversation
 *               model:
 *                 type: string
 *                 description: Model mặc định
 *               systemPrompt:
 *                 type: string
 *                 description: System prompt cho conversation
 *           examples:
 *             simple:
 *               summary: Tạo cơ bản
 *               value: {}
 *             withSettings:
 *               summary: Có settings
 *               value:
 *                 title: "Python Project Help"
 *                 model: "claude-sonnet-4-20250514"
 *                 systemPrompt: "You are an expert Python developer."
 *
 *     responses:
 *       201:
 *         description: Tạo conversation thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *             example:
 *               id: "conv_new123"
 *               title: "New conversation"
 *               model: "claude-sonnet-4-20250514"
 *               messageCount: 0
 *               createdAt: "2024-03-20T15:00:00Z"
 *               updatedAt: "2024-03-20T15:00:00Z"
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
  "/conversations/new",
  authMiddleware,
  asyncHandler((req, res) => chatController.newConversation(req, res)),
);

/**
 * @swagger
 * /chat/conversations/{conversationId}:
 *   get:
 *     tags: [Chat]
 *     summary: Lịch sử chat của conversation
 *     description: |
 *       Lấy toàn bộ lịch sử messages của một conversation.
 *
 *       **Thông tin trả về:**
 *       - Chi tiết conversation
 *       - Danh sách messages theo thứ tự thời gian
 *       - Mỗi message có: role, content, model, usage, timestamp
 *
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *         example: "conv_abc123"
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Số messages tối đa
 *
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Lấy messages trước message ID này (pagination)
 *
 *     responses:
 *       200:
 *         description: Lịch sử chat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation:
 *                   $ref: '#/components/schemas/Conversation'
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChatMessage'
 *                 hasMore:
 *                   type: boolean
 *             example:
 *               conversation:
 *                 id: "conv_abc123"
 *                 title: "Python Help"
 *                 model: "claude-sonnet-4-20250514"
 *               messages:
 *                 - id: "msg_001"
 *                   role: "user"
 *                   content: "How to sort a list in Python?"
 *                   createdAt: "2024-03-20T10:00:00Z"
 *                 - id: "msg_002"
 *                   role: "assistant"
 *                   content: "You can use the sorted() function or list.sort() method..."
 *                   model: "claude-sonnet-4-20250514"
 *                   usage:
 *                     inputTokens: 50
 *                     outputTokens: 150
 *                   createdAt: "2024-03-20T10:00:05Z"
 *               hasMore: false
 *
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       403:
 *         description: Không phải conversation của bạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Conversation không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/conversations/:conversationId",
  authMiddleware,
  asyncHandler((req, res) => chatController.getHistory(req, res)),
);

/**
 * @swagger
 * /chat/conversations/{conversationId}:
 *   delete:
 *     tags: [Chat]
 *     summary: Xóa conversation
 *     description: |
 *       Xóa vĩnh viễn một conversation và tất cả messages.
 *
 *       ⚠️ **Cảnh báo:**
 *       - Thao tác KHÔNG THỂ hoàn tác
 *       - Tất cả messages trong conversation sẽ bị xóa
 *
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID cần xóa
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
 *         description: Không phải conversation của bạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *       404:
 *         description: Conversation không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  "/conversations/:conversationId",
  authMiddleware,
  asyncHandler((req, res) => chatController.deleteConversation(req, res)),
);

export default router;
