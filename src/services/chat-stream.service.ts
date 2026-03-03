/**
 * Chat Stream Service - Streaming chat via SSE
 * - Connects to user's Moltbot gateway with stream:true
 * - Forwards chunks to client via Server-Sent Events
 * - Tracks usage for billing after stream completes
 */

import type { Response } from "express";
import { ApiError, ErrorCode, Errors } from "../core/errors/api-error";
import { usersRepo, chatMessagesRepo } from "../db/index";
import { tokenService } from "./token.service";
import { analyticsService } from "./analytics.service";
import { MSG } from "../constants/messages";

// Config — model sent to gateway's /v1/chat/completions (set CHAT_MODEL in .env)
const DEFAULT_MODEL = process.env.CHAT_MODEL || "operis/operis-multi";
const STREAM_TIMEOUT_MS = 600_000; // Total stream timeout — 10min for long agent runs (tool calls)
const CHUNK_TIMEOUT_MS = 300_000; // Max wait between chunks — 5min for tool execution (browser, code, etc.)
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

interface ImageInput {
  data: string;
  mimeType: string;
}

interface StreamOptions {
  conversationId?: string;
  systemPrompt?: string;
  images?: ImageInput[];
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
    throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, MSG.GATEWAY_NOT_CONFIGURED);
  }

  const convId = options?.conversationId || generateConversationId();

  // Load conversation history
  const history = await loadConversationHistory(userId, convId);

  // NOTE: User message is saved AFTER stream completes successfully (deferred save).
  // This prevents orphaned user messages when user presses stop mid-stream.

  // Build messages: system prompt (if any) + history + new message
  const messages: Array<{ role: string; content: string | unknown[] }> = [];
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push(...history);

  // Build user message — with image_url content parts if images provided
  if (options?.images && options.images.length > 0) {
    const contentParts: unknown[] = [{ type: "text", text: message }];
    for (const img of options.images) {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}` },
      });
    }
    messages.push({ role: "user", content: contentParts });
  } else {
    messages.push({ role: "user", content: message });
  }

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
  let actualModel = ""; // Captured from gateway response chunks
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
          throw new Error(MSG.NO_RESPONSE_BODY);
        }

        // Read stream with per-chunk timeout to detect stalled connections
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let firstDeltaSent = false;
        let isAuthError = false;

        try {
          // Single abort-on-disconnect promise reused across all iterations (no leak)
          const disconnectPromise = new Promise<never>((_, reject) => {
            if (attemptController.signal.aborted) return reject(new Error("Client disconnected"));
            attemptController.signal.addEventListener("abort", () => reject(new Error("Client disconnected")), { once: true });
          });

          while (true) {
            // Race: reader vs chunk timeout vs client disconnect
            // Clear timeout each iteration to prevent timer leak
            let chunkTimer: ReturnType<typeof setTimeout> | undefined;
            const chunkTimeoutPromise = new Promise<never>((_, reject) => {
              chunkTimer = setTimeout(() => reject(new Error("Chunk timeout")), CHUNK_TIMEOUT_MS);
            });

            let chunkResult: ReadableStreamReadResult<Uint8Array>;
            try {
              chunkResult = await Promise.race([
                reader.read(),
                chunkTimeoutPromise,
                disconnectPromise,
              ]);
            } finally {
              clearTimeout(chunkTimer);
            }

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
                  // Capture actual model from gateway response (e.g. "byteplus/kimi-k2.5")
                  if (!actualModel && chunk.model) {
                    actualModel = chunk.model;
                  }
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

          // Process remaining buffer (usage chunk may not end with \n)
          if (buffer.trim()) {
            for (const line of buffer.split("\n")) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                  const chunk = JSON.parse(data);
                  if (!actualModel && chunk.model) actualModel = chunk.model;
                  if (chunk.usage) {
                    inputTokens = chunk.usage.prompt_tokens || 0;
                    outputTokens = chunk.usage.completion_tokens || 0;
                    totalTokens = chunk.usage.total_tokens || 0;
                    contextWindow = chunk.usage.context_window || 0;
                  }
                } catch { /* skip */ }
              }
            }
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

    // Skip saving/billing if client disconnected (user pressed stop)
    if (clientDisconnected) {
      console.log(`[chat-stream] Client disconnected, skipping save for conv ${convId}`);
      return;
    }

    // Estimate tokens if not provided by gateway
    if (inputTokens === 0) inputTokens = estimateTokens(message);
    if (outputTokens === 0) outputTokens = estimateTokens(fullContent);
    if (totalTokens === 0) totalTokens = inputTokens + outputTokens;

    // Use actual model from gateway response, fallback to DEFAULT_MODEL
    const resolvedModel = actualModel || DEFAULT_MODEL;
    const provider = resolvedModel.includes("/") ? resolvedModel.split("/")[0] : "anthropic";

    // Calculate cost
    const pricing = PRICING[resolvedModel] || PRICING[DEFAULT_MODEL] || { input: 0, output: 0 };
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Deduct tokens from logged-in user (JWT)
    if (totalTokens > 0) {
      const currentBalance = (user.token_balance ?? 0) + (user.free_token_balance ?? 0);
      if (currentBalance < totalTokens) {
        sendSSE(res, "error", { error: "Insufficient token balance" });
        res.end();
        return;
      }
      await tokenService.debit(userId, totalTokens, `Chat: ${message.slice(0, 30)}...`);
      await analyticsService.recordUsage({
        user_id: userId,
        request_type: "chat",
        request_id: convId,
        model: resolvedModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_tokens: totalTokens,
        metadata: { message_preview: message.slice(0, 50) },
      });
    }

    // Save user message (deferred — only on successful stream completion)
    await chatMessagesRepo.createMessage({
      user_id: userId,
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // Save assistant response with usage data
    await chatMessagesRepo.createMessage({
      user_id: userId,
      conversation_id: convId,
      role: "assistant",
      content: fullContent,
      model: resolvedModel,
      provider,
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
      tokenBalance: (updatedUser?.token_balance ?? 0) + (updatedUser?.free_token_balance ?? 0),
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
