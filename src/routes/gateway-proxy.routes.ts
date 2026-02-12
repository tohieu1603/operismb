/**
 * Gateway Proxy Routes
 * Proxy requests từ Operis API đến user's Moltbot Gateway
 *
 * Tất cả endpoints yêu cầu:
 * - Authentication (JWT Bearer Token)
 * - User phải có gateway_url và gateway_token trong profile
 */

import { Router } from "express";
import { gatewayProxyController } from "../controllers/gateway-proxy.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================
// Swagger Schemas
// ============================================

/**
 * @swagger
 * components:
 *   schemas:
 *     WakeRequest:
 *       type: object
 *       required:
 *         - text
 *       properties:
 *         text:
 *           type: string
 *           description: Nội dung event inject vào main session
 *           example: "Nhắc user về cuộc họp lúc 3h chiều"
 *         mode:
 *           type: string
 *           enum: [now, next-heartbeat]
 *           default: now
 *           description: |
 *             Chế độ wake:
 *             - `now`: Trigger heartbeat ngay lập tức
 *             - `next-heartbeat`: Đợi heartbeat cycle tiếp theo
 *
 *     WakeResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: true
 *         mode:
 *           type: string
 *           enum: [now, next-heartbeat]
 *           example: now
 *
 *     AgentRequest:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           description: Message gửi đến agent
 *           example: "Tổng hợp tin tức công nghệ hôm nay"
 *         name:
 *           type: string
 *           description: Tên hiển thị cho job
 *           default: Hook
 *           example: "Daily News"
 *         wakeMode:
 *           type: string
 *           enum: [now, next-heartbeat]
 *           default: now
 *         sessionKey:
 *           type: string
 *           description: Session key (để empty = isolated session mới)
 *           example: "hook:daily-news"
 *         deliver:
 *           type: boolean
 *           description: Gửi output qua messaging channel
 *           default: true
 *         channel:
 *           type: string
 *           enum: [last, telegram, whatsapp, discord, signal, slack]
 *           description: Kênh gửi output
 *           example: telegram
 *         to:
 *           type: string
 *           description: Recipient (phone/username)
 *           example: "@username"
 *         model:
 *           type: string
 *           description: Override AI model
 *           example: "claude-sonnet-4-20250514"
 *         thinking:
 *           type: string
 *           enum: [low, medium, high]
 *           description: Thinking level
 *           example: low
 *         timeoutSeconds:
 *           type: integer
 *           description: Timeout in seconds
 *           default: 120
 *           example: 120
 *
 *     AgentResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: true
 *         runId:
 *           type: string
 *           format: uuid
 *           description: ID của agent run
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *
 *     ResponsesRequest:
 *       type: object
 *       required:
 *         - input
 *       properties:
 *         model:
 *           type: string
 *           description: AI model
 *           example: "claude-sonnet-4-20250514"
 *         input:
 *           type: array
 *           description: Conversation history
 *           items:
 *             type: object
 *             required:
 *               - type
 *               - role
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [message]
 *               role:
 *                 type: string
 *                 enum: [system, developer, user, assistant]
 *               content:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: object
 *           example:
 *             - type: message
 *               role: system
 *               content: "You are a helpful assistant"
 *             - type: message
 *               role: user
 *               content: "Hello, how are you?"
 *         stream:
 *           type: boolean
 *           description: Enable streaming (SSE)
 *           default: false
 *         tools:
 *           type: array
 *           description: Tool definitions
 *           items:
 *             type: object
 *         tool_choice:
 *           oneOf:
 *             - type: string
 *               enum: [auto, none, required]
 *             - type: object
 *         instructions:
 *           type: string
 *           description: System instructions
 *         metadata:
 *           type: object
 *           description: Custom metadata
 *
 *     InvokeToolRequest:
 *       type: object
 *       required:
 *         - tool
 *       properties:
 *         tool:
 *           type: string
 *           description: Tên tool cần invoke
 *           example: "web_search"
 *         parameters:
 *           type: object
 *           description: Parameters cho tool
 *           example:
 *             query: "AI news today"
 *
 *     GatewayHealthResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           description: Gateway có thể kết nối được không
 *           example: true
 *         gateway:
 *           type: string
 *           description: Gateway URL đang sử dụng
 *           example: "http://localhost:18789"
 *
 *     GatewayError:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Gateway not configured"
 */

// ============================================
// Routes with Swagger Documentation
// ============================================

/**
 * @swagger
 * /api/v1/gateway/health:
 *   get:
 *     summary: Kiểm tra kết nối Gateway
 *     description: |
 *       Test connection đến user's Moltbot Gateway.
 *       User phải cấu hình `gateway_url` và `gateway_token` trong profile.
 *     tags: [Gateway Proxy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Health check result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GatewayHealthResponse'
 *       401:
 *         description: Chưa đăng nhập
 *       503:
 *         description: Gateway chưa được cấu hình
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GatewayError'
 */
router.get("/health", gatewayProxyController.health);

/**
 * @swagger
 * /api/v1/gateway/wake:
 *   post:
 *     summary: System Event - Inject vào Main Session
 *     description: |
 *       Inject system event vào main session của agent.
 *       Agent sẽ xử lý với **full conversation context** (conversation history).
 *
 *       **Use cases:**
 *       - Reminders, notifications
 *       - Context-aware scheduled tasks
 *       - Trigger agent với context hiện có
 *
 *       **Lưu ý:** Event được đưa vào inbox của main session và được xử lý
 *       trong heartbeat cycle tiếp theo (hoặc ngay lập tức nếu `mode=now`).
 *     tags: [Gateway Proxy]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WakeRequest'
 *           examples:
 *             reminder:
 *               summary: Reminder
 *               value:
 *                 text: "Nhắc user về cuộc họp lúc 3h chiều"
 *                 mode: "now"
 *             notification:
 *               summary: Notification
 *               value:
 *                 text: "Có email mới từ support@company.com"
 *                 mode: "next-heartbeat"
 *     responses:
 *       200:
 *         description: Event đã được inject thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WakeResponse'
 *       400:
 *         description: Request không hợp lệ (thiếu text)
 *       401:
 *         description: Chưa đăng nhập
 *       402:
 *         description: Không đủ token
 *       503:
 *         description: Gateway error hoặc chưa cấu hình
 */
router.post("/wake", gatewayProxyController.wake);

/**
 * @swagger
 * /api/v1/gateway/agent:
 *   post:
 *     summary: Agent Turn - Isolated Session với Delivery
 *     description: |
 *       Chạy agent turn trong **isolated session** (không có conversation history).
 *       Có thể gửi output qua messaging channels (Telegram, WhatsApp, Discord, etc.).
 *
 *       **Use cases:**
 *       - Scheduled tasks (cronjobs)
 *       - Automated reports
 *       - Notifications với AI-generated content
 *       - Independent AI processing
 *
 *       **Flow:**
 *       1. Tạo isolated session mới (hoặc dùng sessionKey nếu có)
 *       2. Agent xử lý message
 *       3. Nếu `deliver=true`, output được gửi qua channel
 *       4. Summary được post về main session
 *     tags: [Gateway Proxy]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentRequest'
 *           examples:
 *             basic:
 *               summary: Basic agent call
 *               value:
 *                 message: "Tổng hợp tin tức công nghệ hôm nay"
 *             with_delivery:
 *               summary: Agent với delivery
 *               value:
 *                 message: "Tạo báo cáo doanh thu tuần này"
 *                 name: "Weekly Report"
 *                 deliver: true
 *                 channel: "telegram"
 *                 to: "@manager"
 *             full_options:
 *               summary: Full options
 *               value:
 *                 message: "Phân tích code review cho PR #123"
 *                 name: "Code Review"
 *                 wakeMode: "now"
 *                 sessionKey: "hook:code-review:pr-123"
 *                 deliver: true
 *                 channel: "slack"
 *                 to: "#dev-team"
 *                 model: "claude-sonnet-4-20250514"
 *                 thinking: "medium"
 *                 timeoutSeconds: 180
 *     responses:
 *       200:
 *         description: Agent run đã được khởi tạo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentResponse'
 *       400:
 *         description: Request không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       402:
 *         description: Không đủ token
 *       503:
 *         description: Gateway error
 */
router.post("/agent", gatewayProxyController.agent);

/**
 * @swagger
 * /api/v1/gateway/hooks/{hookName}:
 *   post:
 *     summary: Custom Webhook
 *     description: |
 *       Forward custom webhook đến Moltbot Gateway.
 *       Gateway sẽ xử lý theo hook mappings đã cấu hình.
 *
 *       **Preset hooks:**
 *       - `gmail`: Email notifications
 *       - `github`: GitHub webhooks
 *       - Custom hooks theo cấu hình gateway
 *     tags: [Gateway Proxy]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: hookName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Tên hook (e.g., "gmail", "github", custom)
 *         example: gmail
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           examples:
 *             gmail:
 *               summary: Gmail webhook
 *               value:
 *                 messages:
 *                   - id: "msg-123"
 *                     from: "sender@example.com"
 *                     subject: "Meeting Tomorrow"
 *                     snippet: "Don't forget our meeting..."
 *             github:
 *               summary: GitHub webhook
 *               value:
 *                 action: "opened"
 *                 repository:
 *                   full_name: "user/repo"
 *                 pull_request:
 *                   title: "Add new feature"
 *     responses:
 *       200:
 *         description: Webhook đã được xử lý
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Chưa đăng nhập
 *       402:
 *         description: Không đủ token
 *       503:
 *         description: Gateway error
 */
router.post("/hooks/:hookName", gatewayProxyController.customHook);

/**
 * @swagger
 * /api/v1/gateway/responses:
 *   post:
 *     summary: OpenResponses API - Full AI API
 *     description: |
 *       OpenResponses-compatible API endpoint.
 *       Hỗ trợ đầy đủ features: multimodal, tools, streaming.
 *
 *       **Tham khảo:** https://www.open-responses.com/
 *
 *       **Features:**
 *       - Multimodal input (text, images, files)
 *       - Function calling (tools)
 *       - Streaming (SSE)
 *       - Tool choice control
 *
 *       **Input types:**
 *       - `message`: Text message với role
 *       - `input_text`: Text content part
 *       - `input_image`: Image (URL hoặc base64)
 *       - `input_file`: File (PDF, text, etc.)
 *     tags: [Gateway Proxy]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResponsesRequest'
 *           examples:
 *             simple:
 *               summary: Simple chat
 *               value:
 *                 model: "claude-sonnet-4-20250514"
 *                 input:
 *                   - type: message
 *                     role: user
 *                     content: "Hello, how are you?"
 *             with_tools:
 *               summary: With tools
 *               value:
 *                 model: "claude-sonnet-4-20250514"
 *                 input:
 *                   - type: message
 *                     role: user
 *                     content: "What's the weather in Hanoi?"
 *                 tools:
 *                   - type: function
 *                     function:
 *                       name: get_weather
 *                       description: Get current weather
 *                       parameters:
 *                         type: object
 *                         properties:
 *                           location:
 *                             type: string
 *                         required:
 *                           - location
 *                 tool_choice: auto
 *             streaming:
 *               summary: Streaming
 *               value:
 *                 model: "claude-sonnet-4-20250514"
 *                 input:
 *                   - type: message
 *                     role: user
 *                     content: "Tell me a story"
 *                 stream: true
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: OpenResponses response object
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: SSE stream events
 *       400:
 *         description: Request không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       402:
 *         description: Không đủ token
 *       503:
 *         description: Gateway error
 */
router.post("/responses", gatewayProxyController.responses);

/**
 * @swagger
 * /api/v1/gateway/tools/invoke:
 *   post:
 *     summary: Direct Tool Invocation
 *     description: |
 *       Invoke tool trực tiếp trên Gateway.
 *       Không qua AI model, gọi thẳng tool implementation.
 *
 *       **Cảnh báo:** Một số tools có thể gây hại nếu sử dụng không đúng cách.
 *       Chỉ sử dụng khi biết rõ tool làm gì.
 *     tags: [Gateway Proxy]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InvokeToolRequest'
 *           examples:
 *             web_search:
 *               summary: Web search
 *               value:
 *                 tool: "web_search"
 *                 parameters:
 *                   query: "AI news today"
 *             browser:
 *               summary: Open browser
 *               value:
 *                 tool: "browser"
 *                 parameters:
 *                   action: "open"
 *                   targetUrl: "https://example.com"
 *     responses:
 *       200:
 *         description: Tool execution result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 result:
 *                   type: object
 *       400:
 *         description: Request không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       402:
 *         description: Không đủ token
 *       503:
 *         description: Gateway error
 */
router.post("/tools/invoke", gatewayProxyController.invokeTool);

/**
 * @swagger
 * /api/v1/gateway/chat/completions:
 *   post:
 *     summary: OpenAI-compatible Chat Completions
 *     description: |
 *       OpenAI-compatible chat completions API.
 *       **Trả về kết quả ngay lập tức** (synchronous), không cần kiểm tra runId.
 *
 *       **Đây là endpoint được khuyến nghị** khi cần lấy AI response trực tiếp.
 *
 *       **Format:**
 *       ```json
 *       {
 *         "choices": [{
 *           "message": {
 *             "role": "assistant",
 *             "content": "AI response text here"
 *           }
 *         }]
 *       }
 *       ```
 *     tags: [Gateway Proxy]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               model:
 *                 type: string
 *                 description: AI model
 *                 example: "claude-sonnet-4-20250514"
 *               messages:
 *                 type: array
 *                 description: Conversation messages
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *                 example:
 *                   - role: "user"
 *                     content: "Xin chào, bạn là ai?"
 *               stream:
 *                 type: boolean
 *                 default: false
 *               max_tokens:
 *                 type: integer
 *                 description: Maximum tokens in response
 *                 example: 4096
 *               temperature:
 *                 type: number
 *                 description: Temperature (0-2)
 *                 example: 0.7
 *           examples:
 *             simple:
 *               summary: Simple chat
 *               value:
 *                 messages:
 *                   - role: "user"
 *                     content: "Xin chào, bạn là ai?"
 *             with_system:
 *               summary: With system prompt
 *               value:
 *                 model: "claude-sonnet-4-20250514"
 *                 messages:
 *                   - role: "system"
 *                     content: "You are a helpful assistant that speaks Vietnamese."
 *                   - role: "user"
 *                     content: "Hôm nay thời tiết thế nào?"
 *                 max_tokens: 1000
 *     responses:
 *       200:
 *         description: AI response (OpenAI format)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "chatcmpl-abc123"
 *                 object:
 *                   type: string
 *                   example: "chat.completion"
 *                 created:
 *                   type: integer
 *                 model:
 *                   type: string
 *                 choices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index:
 *                         type: integer
 *                       message:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           content:
 *                             type: string
 *                       finish_reason:
 *                         type: string
 *                 usage:
 *                   type: object
 *                   properties:
 *                     prompt_tokens:
 *                       type: integer
 *                     completion_tokens:
 *                       type: integer
 *                     total_tokens:
 *                       type: integer
 *       400:
 *         description: Request không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       402:
 *         description: Không đủ token
 *       503:
 *         description: Gateway error
 */
router.post("/chat/completions", gatewayProxyController.chatCompletions);

export default router;
