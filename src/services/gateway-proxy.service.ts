/**
 * Gateway Proxy Service
 * Proxy requests từ Operis API đến user's Moltbot Gateway
 *
 * Operis đóng vai trò middleware:
 * - Authenticate user (JWT/API Key)
 * - Check token balance
 * - Rate limiting
 * - Forward to user's Moltbot Gateway
 * - Deduct tokens
 * - Log requests
 */

import { Errors } from "../core/errors/api-error.js";
import { tokenService } from "./token.service.js";
import { usersRepo } from "../db/index.js";

// Config
const GATEWAY_TIMEOUT_MS = 120_000;

// ============================================
// Types
// ============================================

/** Wake endpoint request */
export interface WakeRequest {
  text: string;
  mode?: "now" | "next-heartbeat";
}

/** Wake endpoint response */
export interface WakeResponse {
  ok: boolean;
  mode: "now" | "next-heartbeat";
}

/** Agent endpoint request */
export interface AgentRequest {
  message: string;
  name?: string;
  wakeMode?: "now" | "next-heartbeat";
  sessionKey?: string;
  deliver?: boolean;
  channel?: "last" | "telegram" | "whatsapp" | "discord" | "signal" | "slack";
  to?: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
}

/** Agent endpoint response */
export interface AgentResponse {
  ok: boolean;
  runId: string;
}

/** OpenResponses request */
export interface ResponsesRequest {
  model?: string;
  input: Array<{
    type: "message";
    role: "system" | "developer" | "user" | "assistant";
    content: string | Array<{ type: string; text?: string; source?: unknown }>;
  }>;
  stream?: boolean;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  instructions?: string;
  metadata?: Record<string, unknown>;
}

/** Custom hook request */
export interface CustomHookRequest {
  [key: string]: unknown;
}

/** Gateway error */
export interface GatewayError {
  ok: false;
  error: string;
}

// Token costs (estimated)
const ESTIMATED_TOKENS = {
  wake: 100,
  agent: 500,
  hook: 300,
};

// ============================================
// Gateway Proxy Service
// ============================================

class GatewayProxyService {
  /**
   * Get user's gateway config
   * @param forHooks - true để lấy hooks token thay vì gateway token
   */
  private async getUserGateway(
    userId: string,
    forHooks = false
  ): Promise<{ url: string; token: string; hooksToken?: string }> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    if (!user.is_active) throw Errors.accountDeactivated();

    if (!user.gateway_url || !user.gateway_token) {
      throw Errors.serviceUnavailable(
        "Gateway not configured. Please set gateway_url and gateway_token in your profile."
      );
    }

    // For hooks endpoints, use hooks_token if available
    const token = forHooks && user.gateway_hooks_token
      ? user.gateway_hooks_token
      : user.gateway_token;

    return {
      url: user.gateway_url,
      token,
      hooksToken: user.gateway_hooks_token || undefined,
    };
  }

  /**
   * Check and deduct tokens
   */
  private async checkAndDeductTokens(
    userId: string,
    estimatedTokens: number,
    description: string
  ): Promise<void> {
    const balance = await tokenService.getBalance(userId);
    if (balance < estimatedTokens) {
      throw Errors.insufficientBalance(balance, estimatedTokens);
    }
    await tokenService.debit(userId, estimatedTokens, description);
  }

  /**
   * Make HTTP request to gateway
   */
  private async callGateway<T>(
    gatewayUrl: string,
    gatewayToken: string,
    endpoint: string,
    body: unknown,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs || GATEWAY_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${gatewayUrl}${endpoint}`;
      console.log(`[gateway-proxy] POST ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[gateway-proxy] Error ${response.status}:`, errorText);

        try {
          const errorJson = JSON.parse(errorText);
          throw Errors.serviceUnavailable(errorJson.error || `Gateway error: ${response.status}`);
        } catch {
          throw Errors.serviceUnavailable(`Gateway error: ${response.status}`);
        }
      }

      return await response.json() as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw Errors.serviceUnavailable("Gateway timeout");
      }
      throw error;
    }
  }

  // ============================================
  // Public Methods - Proxy Endpoints
  // ============================================

  /**
   * POST /hooks/wake - System Event
   * Inject event vào main session, agent xử lý với full conversation context
   */
  async wake(userId: string, request: WakeRequest): Promise<WakeResponse> {
    const gateway = await this.getUserGateway(userId, true); // Use hooks token

    // Validate
    if (!request.text?.trim()) {
      throw Errors.badRequest("text is required");
    }

    // Check & deduct tokens
    await this.checkAndDeductTokens(
      userId,
      ESTIMATED_TOKENS.wake,
      `Wake: ${request.text.slice(0, 30)}...`
    );

    // Call gateway
    const response = await this.callGateway<WakeResponse>(
      gateway.url,
      gateway.token,
      "/hooks/wake",
      {
        text: request.text.trim(),
        mode: request.mode || "now",
      }
    );

    return response;
  }

  /**
   * POST /hooks/agent - Agent Turn với Delivery
   * Chạy agent turn trong isolated session, có thể gửi kết quả qua messaging channel
   */
  async agent(userId: string, request: AgentRequest): Promise<AgentResponse> {
    const gateway = await this.getUserGateway(userId, true); // Use hooks token

    // Validate
    if (!request.message?.trim()) {
      throw Errors.badRequest("message is required");
    }

    // Check & deduct tokens
    await this.checkAndDeductTokens(
      userId,
      ESTIMATED_TOKENS.agent,
      `Agent: ${request.message.slice(0, 30)}...`
    );

    // Build request
    const payload: Record<string, unknown> = {
      message: request.message.trim(),
    };

    // Optional fields
    if (request.name) payload.name = request.name;
    if (request.wakeMode) payload.wakeMode = request.wakeMode;
    if (request.sessionKey) payload.sessionKey = request.sessionKey;
    if (request.deliver !== undefined) payload.deliver = request.deliver;
    if (request.channel) payload.channel = request.channel;
    if (request.to) payload.to = request.to;
    if (request.model) payload.model = request.model;
    if (request.thinking) payload.thinking = request.thinking;
    if (request.timeoutSeconds) payload.timeoutSeconds = request.timeoutSeconds;

    // Call gateway
    const response = await this.callGateway<AgentResponse>(
      gateway.url,
      gateway.token,
      "/hooks/agent",
      payload,
      { timeoutMs: (request.timeoutSeconds || 120) * 1000 }
    );

    return response;
  }

  /**
   * POST /hooks/{name} - Custom Webhook
   * Forward custom webhook đến gateway
   */
  async customHook(
    userId: string,
    hookName: string,
    request: CustomHookRequest
  ): Promise<unknown> {
    const gateway = await this.getUserGateway(userId, true); // Use hooks token

    // Check & deduct tokens
    await this.checkAndDeductTokens(
      userId,
      ESTIMATED_TOKENS.hook,
      `Hook: ${hookName}`
    );

    // Call gateway
    const response = await this.callGateway<unknown>(
      gateway.url,
      gateway.token,
      `/hooks/${hookName}`,
      request
    );

    return response;
  }

  /**
   * POST /v1/responses - OpenResponses API
   * Full-featured AI API với tools, multimodal, streaming
   */
  async responses(
    userId: string,
    request: ResponsesRequest,
    onStream?: (event: string, data: unknown) => void
  ): Promise<unknown> {
    const gateway = await this.getUserGateway(userId);

    // Validate
    if (!request.input || request.input.length === 0) {
      throw Errors.badRequest("input is required");
    }

    // Estimate tokens from input
    const inputText = request.input
      .map((item) =>
        typeof item.content === "string"
          ? item.content
          : JSON.stringify(item.content)
      )
      .join(" ");
    const estimatedTokens = Math.max(500, Math.ceil(inputText.length / 4));

    // Check & deduct tokens
    await this.checkAndDeductTokens(
      userId,
      estimatedTokens,
      `Responses: ${inputText.slice(0, 30)}...`
    );

    // For streaming, we need special handling
    if (request.stream && onStream) {
      return this.streamResponses(gateway.url, gateway.token, request, onStream);
    }

    // Non-streaming
    const response = await this.callGateway<unknown>(
      gateway.url,
      gateway.token,
      "/v1/responses",
      request
    );

    return response;
  }

  /**
   * Stream responses (SSE)
   */
  private async streamResponses(
    gatewayUrl: string,
    gatewayToken: string,
    request: ResponsesRequest,
    onStream: (event: string, data: unknown) => void
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

    try {
      const response = await fetch(`${gatewayUrl}/v1/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ ...request, stream: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw Errors.serviceUnavailable(`Gateway error: ${response.status}`);
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw Errors.serviceUnavailable("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            const eventType = line.slice(6).trim();
            // Next line should be data
            continue;
          }
          if (line.startsWith("data:")) {
            const dataStr = line.slice(5).trim();
            if (dataStr === "[DONE]") {
              onStream("done", null);
              return;
            }
            try {
              const data = JSON.parse(dataStr);
              onStream(data.type || "data", data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw Errors.serviceUnavailable("Gateway timeout");
      }
      throw error;
    }
  }

  /**
   * POST /tools/invoke - Direct tool invocation
   */
  async invokeTools(
    userId: string,
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    const gateway = await this.getUserGateway(userId);

    // Check & deduct tokens
    await this.checkAndDeductTokens(
      userId,
      ESTIMATED_TOKENS.hook,
      `Tool: ${toolName}`
    );

    // Call gateway
    const response = await this.callGateway<unknown>(
      gateway.url,
      gateway.token,
      "/tools/invoke",
      { tool: toolName, parameters }
    );

    return response;
  }

  /**
   * POST /v1/chat/completions - OpenAI Compatible API
   * Synchronous response với full content
   */
  async chatCompletions(
    userId: string,
    request: {
      model?: string;
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
      max_tokens?: number;
      temperature?: number;
    }
  ): Promise<unknown> {
    const gateway = await this.getUserGateway(userId);

    // Validate
    if (!request.messages || request.messages.length === 0) {
      throw Errors.badRequest("messages is required");
    }

    // Estimate tokens from input
    const inputText = request.messages.map((m) => m.content).join(" ");
    const estimatedTokens = Math.max(500, Math.ceil(inputText.length / 4));

    // Check & deduct tokens
    await this.checkAndDeductTokens(
      userId,
      estimatedTokens,
      `Chat: ${inputText.slice(0, 30)}...`
    );

    // Call gateway
    const response = await this.callGateway<unknown>(
      gateway.url,
      gateway.token,
      "/v1/chat/completions",
      {
        model: request.model || "claude-sonnet-4-20250514",
        messages: request.messages,
        stream: request.stream || false,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
      }
    );

    return response;
  }

  /**
   * Health check - Test gateway connection
   */
  async healthCheck(userId: string): Promise<{ ok: boolean; gateway: string }> {
    const gateway = await this.getUserGateway(userId);

    try {
      // Try to connect (simple fetch to check if gateway is reachable)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(gateway.url, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        ok: response.ok || response.status === 404, // 404 is OK, means server is running
        gateway: gateway.url,
      };
    } catch {
      return {
        ok: false,
        gateway: gateway.url,
      };
    }
  }
}

export const gatewayProxyService = new GatewayProxyService();
