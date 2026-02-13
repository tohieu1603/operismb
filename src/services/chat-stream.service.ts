/**
 * Chat Stream Service - Streaming chat via SSE
 * - Connects to user's Moltbot gateway with stream:true
 * - Forwards chunks to client via Server-Sent Events
 * - Tracks usage for billing after stream completes
 */

import type { Response } from "express";
import { Errors } from "../core/errors/api-error";
import { tokenService } from "./token.service";
import { analyticsService } from "./analytics.service";
import { usersRepo, chatMessagesRepo } from "../db/index";

// Config
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const STREAM_TIMEOUT_MS = 180_000; // Total stream timeout (covers fetch + reading)
const CHUNK_TIMEOUT_MS = 60_000; // Max wait between chunks before aborting
const KEEPALIVE_INTERVAL_MS = 15_000; // SSE keepalive ping to prevent tunnel idle timeout
const MAX_RETRIES = 2;
const AUTH_ERROR_PATTERN = /authentication_error|invalid.*api.key|unauthorized|rate_limit|credit.*balance.*low|billing|FailoverError/i;

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
  systemPrompt?: string;
}

const MAX_HISTORY_MESSAGES = 20;

interface ChatMessage {
  role: "user" | "assistant" | "system";
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
    throw Errors.serviceUnavailable("Gateway");
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

  // Build messages: system prompt (if any) + history + new message
  const messages: ChatMessage[] = [];
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push(...history, { role: "user", content: message });

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

  let fullContent = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let contextWindow = 0;

  // Track client disconnect to abort gateway stream early
  let clientDisconnected = false;
  const onClose = () => { clientDisconnected = true; };
  res.on("close", onClose);

  // SSE keepalive: send comment pings to prevent Cloudflare tunnel idle timeout
  const keepaliveTimer = setInterval(() => {
    if (!clientDisconnected) {
      res.write(": keepalive\n\n");
    }
  }, KEEPALIVE_INTERVAL_MS);

  try {
    // Retry loop: on auth error in first chunk, retry so gateway rotates auth profile
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const attemptController = new AbortController();
      // Abort on client disconnect
      if (clientDisconnected) { attemptController.abort(); break; }
      const onDisconnect = () => attemptController.abort();
      res.on("close", onDisconnect);

      // Total stream timeout (covers fetch + entire stream reading)
      const totalTimeout = setTimeout(() => attemptController.abort(), STREAM_TIMEOUT_MS);

      try {
        const response = await fetch(`${user.gateway_url}/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${user.gateway_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            user: `${userId}-${convId}`,
          }),
          signal: attemptController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gateway error: ${errorText}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read stream with per-chunk timeout to detect stalled connections
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let firstDeltaSent = false;
        let isAuthError = false;

        try {
          while (true) {
            // Race: reader vs chunk timeout vs client disconnect (abort signal)
            const chunkResult = await Promise.race([
              reader.read(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Chunk timeout")), CHUNK_TIMEOUT_MS),
              ),
              new Promise<never>((_, reject) => {
                if (attemptController.signal.aborted) return reject(new Error("Client disconnected"));
                attemptController.signal.addEventListener("abort", () => reject(new Error("Client disconnected")), { once: true });
              }),
            ]);

            const { done, value } = chunkResult;
            if (done) break;
            if (clientDisconnected) break;

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
                    // Check first delta for auth error before sending anything to client
                    if (!firstDeltaSent && AUTH_ERROR_PATTERN.test(delta)) {
                      isAuthError = true;
                      break;
                    }
                    firstDeltaSent = true;
                    fullContent += delta;
                    if (!clientDisconnected) {
                      sendSSE(res, "content", { delta, content: fullContent });
                    }
                  }

                  if (chunk.usage) {
                    inputTokens = chunk.usage.prompt_tokens || 0;
                    outputTokens = chunk.usage.completion_tokens || 0;
                    totalTokens = chunk.usage.total_tokens || 0;
                    contextWindow = chunk.usage.context_window || 0;
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
            if (isAuthError) break;
          }
        } finally {
          // Always cancel reader to close gateway connection and stop processing
          reader.cancel().catch(() => {});
        }

        // If auth error detected in first chunk, retry
        if (isAuthError && attempt < MAX_RETRIES - 1) {
          console.warn(`[chat-stream] Auth error in first chunk (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`);
          await new Promise((r) => setTimeout(r, 1000));
          fullContent = "";
          inputTokens = 0;
          outputTokens = 0;
          totalTokens = 0;
          contextWindow = 0;
          continue;
        }

        if (isAuthError) {
          console.error(`[chat-stream] All ${MAX_RETRIES} attempts failed with auth error`);
          if (!clientDisconnected) {
            sendSSE(res, "error", { error: "All API keys failed. Please check your token vault." });
          }
          res.end();
          return;
        }

        // Success — break retry loop
        break;
      } finally {
        clearTimeout(totalTimeout);
        res.off("close", onDisconnect);
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

    // Save assistant response with usage data
    await chatMessagesRepo.createMessage({
      user_id: userId,
      conversation_id: convId,
      role: "assistant",
      content: fullContent,
      model: DEFAULT_MODEL,
      provider: "anthropic",
      tokens_used: totalTokens,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: totalCost,
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
        context_window: contextWindow,
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost,
      },
      tokenBalance: updatedUser?.token_balance ?? 0,
    });

  } catch (error) {
    if (!clientDisconnected) {
      const errorMsg = error instanceof Error ? error.message : "Stream failed";
      sendSSE(res, "error", { error: errorMsg });
    }
  } finally {
    clearInterval(keepaliveTimer);
    res.off("close", onClose);
    res.end();
  }
}

export const chatStreamService = {
  streamMessage,
};
