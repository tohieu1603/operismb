/**
 * Anthropic-Compatible Routes
 * Provides /v1/messages endpoint matching Anthropic's Messages API format
 * For use as drop-in replacement for api.anthropic.com
 */

import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { apiKeyService } from "../services/api-key.service";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const CHAT_TIMEOUT_MS = 120_000;

// Anthropic Message types
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
  source?: { type: string; media_type: string; data: string };
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string | { type: "text"; text: string }[];
  tools?: AnthropicTool[];
  tool_choice?: { type: string; name?: string };
  stream?: boolean;
  temperature?: number;
  metadata?: { user_id?: string };
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

type AnthropicResponseBlock = AnthropicTextBlock | AnthropicToolUseBlock;

/**
 * Convert Anthropic tools to OpenAI/DeepSeek format
 */
function convertToolsToOpenAI(tools: AnthropicTool[]): unknown[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.input_schema,
    },
  }));
}

/**
 * Convert Anthropic messages to OpenAI format
 */
function convertMessagesToOpenAI(
  messages: AnthropicMessage[],
  systemPrompt?: string
): { role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }[] {
  const result: { role: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }[] = [];

  // Add system prompt first
  if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      result.push({ role: msg.role, content: msg.content });
    } else if (Array.isArray(msg.content)) {
      // Handle array content (text, tool_use, tool_result blocks)
      const textParts: string[] = [];
      const toolCalls: unknown[] = [];
      let toolResultId: string | undefined;
      let toolResultContent: string | undefined;

      for (const block of msg.content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        } else if (block.type === "tool_result") {
          toolResultId = block.tool_use_id;
          toolResultContent = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
        }
      }

      if (toolResultId && toolResultContent) {
        // This is a tool result message
        result.push({
          role: "tool",
          content: toolResultContent,
          tool_call_id: toolResultId,
        });
      } else {
        const openAIMsg: { role: string; content: string; tool_calls?: unknown[] } = {
          role: msg.role,
          content: textParts.join("\n") || "",
        };
        if (toolCalls.length > 0) {
          openAIMsg.tool_calls = toolCalls;
        }
        result.push(openAIMsg);
      }
    }
  }

  return result;
}

/**
 * Authenticate via x-api-key header or Bearer token
 */
async function authenticateApiKey(req: Request): Promise<string | null> {
  // Try x-api-key header first (Anthropic style)
  let apiKey = req.headers["x-api-key"] as string | undefined;
  
  // Fall back to Bearer token
  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7).trim();
    }
  }

  if (!apiKey) return null;

  const result = await apiKeyService.validateKey(apiKey);
  return result?.userId ?? null;
}

/**
 * POST /v1/messages
 * Anthropic-compatible messages endpoint
 */
router.post("/messages", asyncHandler(async (req: Request, res: Response) => {
  console.log("[anthropic-compat] Request received, stream:", req.body?.stream);

  try {
    // Authenticate
    const userId = await authenticateApiKey(req);
    if (!userId) {
      res.status(401).json({
        type: "error",
        error: {
          type: "authentication_error",
          message: "Invalid API key",
        },
      });
      return;
    }

    const body = req.body as AnthropicRequest;
    const isStreaming = body.stream === true;

    // Extract system prompt
    let systemPrompt = "";
    if (typeof body.system === "string") {
      systemPrompt = body.system;
    } else if (Array.isArray(body.system)) {
      systemPrompt = body.system.map((s) => s.text).join("\n");
    }

    // Convert to OpenAI format
    const openAIMessages = convertMessagesToOpenAI(body.messages, systemPrompt);
    const openAITools = body.tools ? convertToolsToOpenAI(body.tools) : undefined;

    console.log("[anthropic-compat] Forwarding", openAIMessages.length, "messages and", openAITools?.length || 0, "tools to DeepSeek");

    // Call DeepSeek API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: body.max_tokens || 4096,
        messages: openAIMessages,
        tools: openAITools,
        tool_choice: openAITools ? "auto" : undefined,
        temperature: body.temperature,
        stream: isStreaming,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("[anthropic-compat] DeepSeek error:", errorText);
      res.status(500).json({
        type: "error",
        error: {
          type: "api_error",
          message: "DeepSeek API error",
        },
      });
      return;
    }

    if (isStreaming) {
      // Streaming response - convert to Anthropic SSE format
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const messageId = `msg_${crypto.randomBytes(16).toString("hex")}`;

      // Send message_start event
      const messageStart = {
        type: "message_start",
        message: {
          id: messageId,
          type: "message",
          role: "assistant",
          content: [],
          model: body.model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      };
      res.write(`event: message_start\ndata: ${JSON.stringify(messageStart)}\n\n`);

      // Read streaming response from DeepSeek
      const reader = deepseekResponse.body?.getReader();
      if (!reader) {
        res.write(`event: error\ndata: ${JSON.stringify({ type: "error", error: { message: "No response body" } })}\n\n`);
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let contentBlockIndex = 0;
      let currentToolCall: { id: string; name: string; arguments: string } | null = null;
      let textContent = "";
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;
              const finishReason = chunk.choices?.[0]?.finish_reason;

              // Handle text content
              if (delta?.content) {
                if (textContent === "") {
                  // Start content block
                  res.write(`event: content_block_start\ndata: ${JSON.stringify({
                    type: "content_block_start",
                    index: contentBlockIndex,
                    content_block: { type: "text", text: "" },
                  })}\n\n`);
                }
                textContent += delta.content;
                res.write(`event: content_block_delta\ndata: ${JSON.stringify({
                  type: "content_block_delta",
                  index: contentBlockIndex,
                  delta: { type: "text_delta", text: delta.content },
                })}\n\n`);
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.name) {
                    // New tool call starting
                    if (textContent !== "") {
                      // Close text block first
                      res.write(`event: content_block_stop\ndata: ${JSON.stringify({
                        type: "content_block_stop",
                        index: contentBlockIndex,
                      })}\n\n`);
                      contentBlockIndex++;
                      textContent = "";
                    }

                    currentToolCall = {
                      id: tc.id || `toolu_${crypto.randomBytes(12).toString("hex")}`,
                      name: tc.function.name,
                      arguments: tc.function.arguments || "",
                    };

                    // Start tool_use block
                    res.write(`event: content_block_start\ndata: ${JSON.stringify({
                      type: "content_block_start",
                      index: contentBlockIndex,
                      content_block: {
                        type: "tool_use",
                        id: currentToolCall.id,
                        name: currentToolCall.name,
                        input: {},
                      },
                    })}\n\n`);
                  } else if (tc.function?.arguments && currentToolCall) {
                    currentToolCall.arguments += tc.function.arguments;
                    res.write(`event: content_block_delta\ndata: ${JSON.stringify({
                      type: "content_block_delta",
                      index: contentBlockIndex,
                      delta: { type: "input_json_delta", partial_json: tc.function.arguments },
                    })}\n\n`);
                  }
                }
              }

              // Handle usage
              if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens || 0;
                outputTokens = chunk.usage.completion_tokens || 0;
              }

              // Handle finish
              if (finishReason) {
                // Close current block
                res.write(`event: content_block_stop\ndata: ${JSON.stringify({
                  type: "content_block_stop",
                  index: contentBlockIndex,
                })}\n\n`);

                // Send message_delta with stop_reason
                const stopReason = finishReason === "tool_calls" ? "tool_use" : "end_turn";
                res.write(`event: message_delta\ndata: ${JSON.stringify({
                  type: "message_delta",
                  delta: { stop_reason: stopReason, stop_sequence: null },
                  usage: { output_tokens: outputTokens },
                })}\n\n`);

                // Send message_stop
                res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      } catch (e) {
        console.error("[anthropic-compat] Streaming error:", e);
      }

      res.end();
    } else {
      // Non-streaming response
      const data = await deepseekResponse.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      // Build Anthropic content blocks
      const content: AnthropicResponseBlock[] = [];

      // Add text content
      if (message?.content) {
        content.push({
          type: "text",
          text: message.content,
        });
      }

      // Add tool_use blocks
      if (message?.tool_calls && Array.isArray(message.tool_calls)) {
        for (const tc of message.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id || `toolu_${crypto.randomBytes(12).toString("hex")}`,
            name: tc.function?.name || "unknown",
            input: JSON.parse(tc.function?.arguments || "{}"),
          });
        }
      }

      // Determine stop_reason
      const finishReason = choice?.finish_reason;
      const stopReason = finishReason === "tool_calls" ? "tool_use" : "end_turn";

      const anthropicResponse = {
        id: `msg_${crypto.randomBytes(16).toString("hex")}`,
        type: "message",
        role: "assistant",
        content,
        model: body.model,
        stop_reason: stopReason,
        stop_sequence: null,
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0,
        },
      };

      res.json(anthropicResponse);
    }
  } catch (error: any) {
    console.error("[anthropic-compat] Error:", error);
    res.status(500).json({
      type: "error",
      error: {
        type: "api_error",
        message: error.message || "Internal server error",
      },
    });
  }
}));

export default router;
