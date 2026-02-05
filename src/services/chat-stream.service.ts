/**
 * Chat Stream Service - Streaming chat via SSE
 * - Connects to user's Moltbot gateway with stream:true
 * - Forwards chunks to client via Server-Sent Events
 * - Tracks usage for billing after stream completes
 */

import type { Response } from "express";
import { Errors } from "../core/errors/api-error.js";
import { tokenService } from "./token.service.js";
import { analyticsService } from "./analytics.service.js";
import { usersRepo, chatMessagesRepo } from "../db/index.js";

// Config
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const STREAM_TIMEOUT_MS = 120_000;

// Pricing per million tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
};

interface StreamOptions {
  conversationId?: string;
}

const MAX_HISTORY_MESSAGES = 20;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Load conversation history from DB
 */
async function loadConversationHistory(
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

/**
 * Estimate tokens from text (~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate UUID v4 for conversation ID
 */
function generateConversationId(): string {
  return crypto.randomUUID();
}

/**
 * Send SSE event to client with flush for realtime delivery
 */
function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // Flush for realtime delivery through proxies
  if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
    (res as unknown as { flush: () => void }).flush();
  }
}

/**
 * Stream chat message to client via SSE
 */
async function streamMessage(
  userId: string,
  message: string,
  res: Response,
  options?: StreamOptions,
): Promise<void> {
  // Get user with gateway config
  const user = await usersRepo.getUserById(userId);
  if (!user) throw Errors.notFound("User");
  if (!user.is_active) throw Errors.accountDeactivated();

  if (!user.gateway_url || !user.gateway_token) {
    throw Errors.serviceUnavailable("Gateway not configured");
  }

  const convId = options?.conversationId || generateConversationId();

  // Load conversation history
  const history = await loadConversationHistory(userId, convId);

  // Save user message to history
  await chatMessagesRepo.createMessage({
    user_id: userId,
    conversation_id: convId,
    role: "user",
    content: message,
  });

  // Build messages with history + new message
  const messages: ChatMessage[] = [...history, { role: "user", content: message }];

  // Setup SSE headers (Cloudflare + Nginx compatible)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();

  // Send conversation ID first
  sendSSE(res, "meta", { conversationId: convId });
  if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
    (res as unknown as { flush: () => void }).flush();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  let fullContent = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  try {
    // Call gateway with stream:true
    const response = await fetch(`${user.gateway_url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.gateway_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages, // History + current message
        stream: true,
        user: `${userId}-${convId}`, // Unique session per user + conversation
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway error: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    // Read stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta?.content;

            if (delta) {
              fullContent += delta;
              sendSSE(res, "content", { delta, content: fullContent });
            }

            // Capture usage if available (use gateway values directly)
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
              totalTokens = chunk.usage.total_tokens || 0;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // Estimate tokens if not provided by gateway
    if (inputTokens === 0) inputTokens = estimateTokens(message);
    if (outputTokens === 0) outputTokens = estimateTokens(fullContent);
    if (totalTokens === 0) totalTokens = inputTokens + outputTokens;

    // Calculate cost
    const pricing = PRICING[DEFAULT_MODEL] || PRICING["claude-sonnet-4-20250514"];
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Deduct tokens
    if (totalTokens > 0) {
      await tokenService.debit(userId, totalTokens, `Chat: ${message.slice(0, 30)}...`);

      // Record usage for analytics
      await analyticsService.recordUsage({
        user_id: userId,
        request_type: "chat",
        request_id: convId,
        model: DEFAULT_MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_tokens: totalTokens,
        metadata: {
          message_preview: message.slice(0, 50),
          stream: true,
        },
      });
    }

    // Save assistant response
    await chatMessagesRepo.createMessage({
      user_id: userId,
      conversation_id: convId,
      role: "assistant",
      content: fullContent,
    });

    // Get updated balance
    const updatedUser = await usersRepo.getUserById(userId);

    // Send final event with usage
    sendSSE(res, "done", {
      conversationId: convId,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost,
      },
      tokenBalance: updatedUser?.token_balance ?? 0,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Stream failed";
    sendSSE(res, "error", { error: errorMsg });
  } finally {
    clearTimeout(timeoutId);
    res.end();
  }
}

export const chatStreamService = {
  streamMessage,
};
