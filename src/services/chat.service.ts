/**
 * Chat Service - User Gateway with billing
 * - Saves chat history to PostgreSQL
 * - Calls user's Moltbot gateway (user provides their own API key via gateway)
 * - Returns Anthropic-compatible response format with tool_use blocks
 */

import crypto from "node:crypto";
import { Errors } from "../core/errors/api-error.js";
import { tokenService } from "./token.service.js";
import { usersRepo, chatMessagesRepo } from "../db/index.js";
import { moltbotClientService } from "./moltbot-client.service.js";

// Config
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const CHAT_TIMEOUT_MS = 120_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOKENS = 4096;

// System prompt - chỉ trả tool calls, không thực thi
const SYSTEM_PROMPT = `Bạn là trợ lý AI có khả năng đề xuất hành động cho người dùng.

Khi người dùng yêu cầu hành động:
- Mở website/URL → dùng tool "browser" với action "open", targetUrl, và profile="clawd"
- Tìm kiếm web → dùng tool "web_search" với query
- Tìm kiếm YouTube → dùng tool "browser" với targetUrl YouTube và profile="clawd"
- Chạy lệnh terminal → dùng tool "exec" với command
- Đọc/ghi file → dùng tool "Read"/"Write"

QUAN TRỌNG: Luôn dùng profile="clawd" cho browser tool, KHÔNG dùng profile="chrome".

Chỉ đề xuất tool calls. Hệ thống khác sẽ thực thi chúng.

Trả lời bằng tiếng Việt, ngắn gọn và rõ ràng.`;

// Default tools - OpenAI/DeepSeek function calling format
const DEFAULT_TOOLS = [
  {
    type: "function",
    function: {
      name: "browser",
      description: "Mở website trong trình duyệt. Dùng cho mọi yêu cầu mở URL, YouTube, social media, trang web bất kỳ.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["open"],
            description: "Hành động: open (mở trang web)",
          },
          targetUrl: {
            type: "string",
            description: "URL đầy đủ. Ví dụ: https://youtube.com/results?search_query=abc hoặc https://google.com",
          },
        },
        required: ["action", "targetUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Tìm kiếm Google với từ khóa",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Từ khóa cần tìm kiếm",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exec",
      description: "Chạy lệnh terminal/shell (cẩn thận với security)",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Lệnh shell, ví dụ: ls -la, pwd, open /Applications",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_read",
      description: "Đọc nội dung file text",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Đường dẫn file cần đọc",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_write",
      description: "Ghi nội dung vào file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Đường dẫn file cần ghi",
          },
          content: {
            type: "string", 
            description: "Nội dung cần ghi vào file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
];

// Pricing per million tokens (USD)
const PRICING = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
} as const;

// ============================================
// Anthropic-compatible Types
// ============================================

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

type ContentBlock = TextBlock | ToolUseBlock;

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentBlock[];
  tool_call_id?: string;
}

// Anthropic-style response format
interface ChatResult {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  usage: TokenUsage;
  // Extended fields for our API
  conversationId: string;
  tokenBalance: number;
  cost: {
    input: number;
    output: number;
    total: number;
  };
}

interface SendMessageOptions {
  conversationId?: string;
  tools?: unknown[];
  messages?: ChatMessage[];
  systemPrompt?: string;
}

class ChatService {
  /**
   * Send message and get Anthropic-style response
   * Calls user's Moltbot gateway (user must configure gateway_url and gateway_token)
   */
  async sendMessage(userId: string, message: string, options?: SendMessageOptions): Promise<ChatResult> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    if (!user.is_active) throw Errors.accountDeactivated();

    // User must have gateway configured
    if (!user.gateway_url || !user.gateway_token) {
      throw Errors.serviceUnavailable("Gateway not configured - please set gateway_url and gateway_token");
    }

    const convId = options?.conversationId || this.generateConversationId();

    // Build message history
    let history: ChatMessage[];
    if (options?.messages && options.messages.length > 0) {
      history = options.messages;
    } else {
      history = await this.loadConversationHistory(userId, convId);
      await chatMessagesRepo.createMessage({
        user_id: userId,
        conversation_id: convId,
        role: "user",
        content: message,
      });
      history.push({ role: "user", content: message });
    }

    // Call user's gateway
    const aiResponse = await this.callUserGateway(
      user.gateway_url,
      user.gateway_token,
      history,
      {
        tools: options?.tools,
        systemPrompt: options?.systemPrompt,
      },
    );

    // Extract text for saving to DB
    const textContent = aiResponse.content
      .filter((block): block is TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    await chatMessagesRepo.createMessage({
      user_id: userId,
      conversation_id: convId,
      role: "assistant",
      content: textContent,
      model: aiResponse.model,
      provider: "anthropic",
      tokens_used: aiResponse.usage.input_tokens + aiResponse.usage.output_tokens,
      cost: aiResponse.cost.total,
    });

    // Deduct tokens
    const tokensToDeduct = aiResponse.usage.input_tokens + aiResponse.usage.output_tokens;
    if (tokensToDeduct > 0 && user.token_balance < tokensToDeduct) {
      throw Errors.insufficientBalance(user.token_balance, tokensToDeduct);
    }

    if (tokensToDeduct > 0) {
      await tokenService.debit(userId, tokensToDeduct, `Chat: ${message.slice(0, 30)}...`);
    }

    const updatedUser = await usersRepo.getUserById(userId);

    return {
      ...aiResponse,
      conversationId: convId,
      tokenBalance: updatedUser?.token_balance ?? 0,
    };
  }

  /**
   * Call user's Moltbot gateway (OpenAI-compatible format)
   */
  private async callUserGateway(
    gatewayUrl: string,
    gatewayToken: string,
    messages: ChatMessage[],
    options?: { tools?: unknown[]; systemPrompt?: string },
  ): Promise<Omit<ChatResult, "conversationId" | "tokenBalance">> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    // Build messages for OpenAI-compatible API
    const apiMessages: Array<{ role: string; content: string }> = [];

    // Add system prompt
    if (options?.systemPrompt) {
      apiMessages.push({ role: "system", content: options.systemPrompt });
    }

    // Convert messages
    for (const m of messages) {
      if (m.role === "tool") {
        apiMessages.push({
          role: "user",
          content: `Tool Result (${m.tool_call_id}): ${m.content}`,
        });
      } else {
        const content = typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.filter((b): b is TextBlock => b.type === "text").map((b) => b.text).join("\n")
            : "";
        if (content) {
          apiMessages.push({ role: m.role, content });
        }
      }
    }

    // Convert tools to OpenAI format
    const apiTools = options?.tools && options.tools.length > 0
      ? options.tools.map((t: any) => ({
          type: "function",
          function: {
            name: t.function?.name || t.name,
            description: t.function?.description || t.description || "",
            parameters: t.function?.parameters || t.parameters || { type: "object", properties: {} },
          },
        }))
      : undefined;

    console.log("[chat] Calling user gateway:", gatewayUrl);
    console.log("[chat] Gateway token:", gatewayToken?.slice(0, 10) + "...");
    console.log("[chat] Messages:", apiMessages.length, "| Tools:", apiTools?.length ?? 0);

    try {
      const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: apiMessages,
          max_tokens: MAX_TOKENS,
          ...(apiTools ? { tools: apiTools } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[chat] Gateway error:", errorText);
        throw Errors.serviceUnavailable("Gateway error");
      }

      const data = await response.json();

      // Parse OpenAI-compatible response to Anthropic format
      const choice = data.choices?.[0];
      const responseMessage = choice?.message;
      const content: ContentBlock[] = [];

      // Add text content
      if (responseMessage?.content) {
        content.push({ type: "text", text: responseMessage.content });
      }

      // Add tool calls (convert from OpenAI format)
      if (responseMessage?.tool_calls) {
        for (const tc of responseMessage.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id || `tool_${crypto.randomUUID().slice(0, 8)}`,
            name: tc.function?.name || "",
            input: JSON.parse(tc.function?.arguments || "{}"),
          });
        }
      }

      // Log tool calls
      const toolCalls = content.filter((b): b is ToolUseBlock => b.type === "tool_use");
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          console.log("[chat] Tool call:", tc.name, JSON.stringify(tc.input, null, 2));
        }
      }

      // Calculate usage and cost
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const model = data.model || DEFAULT_MODEL;
      const pricing = PRICING[model as keyof typeof PRICING] || PRICING["claude-sonnet-4-20250514"];

      const inputCost = (inputTokens / 1_000_000) * pricing.input;
      const outputCost = (outputTokens / 1_000_000) * pricing.output;

      // Determine stop reason
      let stopReason: ChatResult["stop_reason"] = "end_turn";
      if (choice?.finish_reason === "tool_calls" || toolCalls.length > 0) {
        stopReason = "tool_use";
      } else if (choice?.finish_reason === "length") {
        stopReason = "max_tokens";
      }

      return {
        id: data.id || `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
        type: "message",
        role: "assistant",
        content,
        model,
        stop_reason: stopReason,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
        cost: {
          input: inputCost,
          output: outputCost,
          total: inputCost + outputCost,
        },
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw Errors.serviceUnavailable("Gateway timeout");
      }
      throw error;
    }
  }

  private generateConversationId(): string {
    return crypto.randomUUID();
  }

  private async loadConversationHistory(
    userId: string,
    conversationId: string,
  ): Promise<ChatMessage[]> {
    const messages = await chatMessagesRepo.getConversationHistory(
      userId,
      conversationId,
      MAX_HISTORY_MESSAGES,
    );

    return messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
  }

  async getBalance(userId: string): Promise<{ balance: number }> {
    const balance = await tokenService.getBalance(userId);
    return { balance };
  }

  async getConversations(userId: string): Promise<any[]> {
    return chatMessagesRepo.getUserConversations(userId);
  }

  async getHistory(userId: string, conversationId: string): Promise<any[]> {
    return chatMessagesRepo.getConversationHistory(userId, conversationId);
  }

  async newConversation(_userId: string): Promise<{ conversationId: string }> {
    return { conversationId: crypto.randomUUID() };
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await chatMessagesRepo.deleteConversation(userId, conversationId);
  }
}

export const chatService = new ChatService();
