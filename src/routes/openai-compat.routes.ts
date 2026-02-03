/**
 * OpenAI-Compatible Routes
 * Provides /v1/chat/completions endpoint for Moltbot integration
 * Supports both streaming and non-streaming modes
 * Converts tool_use blocks (Anthropic format) to OpenAI tool_calls
 */

import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { chatService } from "../services/chat.service.js";
import { apiKeyService } from "../services/api-key.service.js";

const router = Router();

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

interface OpenAIRequest {
  model?: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  tools?: unknown[];
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Anthropic-style content block types
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

/**
 * Convert Anthropic tool_use blocks to OpenAI tool_calls format
 */
function convertToolUseToToolCalls(content: ContentBlock[]): OpenAIToolCall[] {
  return content
    .filter((block): block is ToolUseBlock => block.type === "tool_use")
    .map((block) => ({
      id: block.id || `call_${crypto.randomBytes(12).toString("hex")}`,
      type: "function" as const,
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input),
      },
    }));
}

/**
 * Extract text content from Anthropic content blocks
 */
function extractTextContent(content: ContentBlock[]): string {
  return content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Check if content has tool_use blocks
 */
function hasToolUse(content: ContentBlock[]): boolean {
  return content.some((block) => block.type === "tool_use");
}

/**
 * Authenticate via Bearer token (API key)
 */
async function authenticateApiKey(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) return null;

  const result = await apiKeyService.validateKey(apiKey);
  return result?.userId ?? null;
}

/**
 * Send SSE event
 */
function sendSSE(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
router.post("/chat/completions", async (req: Request, res: Response) => {
  console.log("[openai-compat] Request received, stream:", req.body?.stream);

  try {
    // Authenticate
    const userId = await authenticateApiKey(req);
    if (!userId) {
      res.status(401).json({
        error: {
          message: "Invalid API key",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      });
      return;
    }

    const body = req.body as OpenAIRequest;
    const messages = body.messages || [];
    const isStreaming = body.stream === true;
    const includeUsage = body.stream_options?.include_usage ?? false;
    const hasTools = Array.isArray(body.tools) && body.tools.length > 0;

    // Extract user message (last user message)
    const userMessages = messages.filter((m) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (!lastUserMessage?.content) {
      res.status(400).json({
        error: {
          message: "No user message provided",
          type: "invalid_request_error",
        },
      });
      return;
    }

    // Pass through all tools - let DeepSeek decide when task is complete
    console.log("[openai-compat] Forwarding", messages.length, "messages,", body.tools?.length || 0, "tools");

    const toolsToPass = body.tools;

    // Call chat service - forward full messages and tools from Moltbot
    const result = await chatService.sendMessage(userId, lastUserMessage.content, {
      tools: toolsToPass,
      messages: messages.map((m) => ({ role: m.role, content: m.content, tool_call_id: m.tool_call_id })),
    });

    // Extract text and tool_use from Anthropic-style content
    const textContent = extractTextContent(result.content as ContentBlock[]);
    const toolCalls = convertToolUseToToolCalls(result.content as ContentBlock[]);
    const hasToolCalls = toolCalls.length > 0;

    const completionId = `chatcmpl-${result.conversationId}`;
    const created = Math.floor(Date.now() / 1000);

    // Use tool_calls if we have them and tools were requested
    const shouldUseToolCalls = hasToolCalls && hasTools;

    // Calculate total tokens
    const totalTokens = result.usage.input_tokens + result.usage.output_tokens;

    // Handle tool_calls - respect streaming preference
    if (shouldUseToolCalls) {
      console.log("[openai-compat] Tool calls detected:", JSON.stringify(toolCalls, null, 2));

      if (isStreaming) {
        // SSE streaming for tool_calls
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // First chunk: role + tool_calls with name only
        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i];
          const chunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model: result.model,
            choices: [{
              index: 0,
              delta: i === 0 ? {
                role: "assistant",
                content: null,
                tool_calls: [{
                  index: i,
                  id: tc.id,
                  type: "function",
                  function: { name: tc.function.name, arguments: "" }
                }]
              } : {
                tool_calls: [{
                  index: i,
                  id: tc.id,
                  type: "function",
                  function: { name: tc.function.name, arguments: "" }
                }]
              },
              finish_reason: null
            }]
          };
          sendSSE(res, chunk);

          // Arguments chunk
          const argsChunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model: result.model,
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: i,
                  function: { arguments: tc.function.arguments }
                }]
              },
              finish_reason: null
            }]
          };
          sendSSE(res, argsChunk);
        }

        // Final chunk
        sendSSE(res, {
          id: completionId,
          object: "chat.completion.chunk",
          created,
          model: result.model,
          choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }]
        });

        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // Non-streaming response
      const message: Record<string, unknown> = {
        role: "assistant",
        content: textContent || null,
        tool_calls: toolCalls,
      };

      res.json({
        id: completionId,
        object: "chat.completion",
        created,
        model: result.model,
        choices: [{ index: 0, message, finish_reason: "tool_calls" }],
        usage: {
          prompt_tokens: result.usage.input_tokens,
          completion_tokens: result.usage.output_tokens,
          total_tokens: totalTokens,
        },
      });
      return;
    }

    if (isStreaming) {
      // Streaming response (SSE) - only for text content, no tool_calls
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      {
        // Stream content only (no tool calls)
        const chunks = textContent.match(/.{1,50}/g) || [textContent || ""];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model: result.model,
            choices: [
              {
                index: 0,
                delta: i === 0
                  ? { role: "assistant", content: chunks[i] }
                  : { content: chunks[i] },
                finish_reason: null,
              },
            ],
          };
          sendSSE(res, chunk);
        }

        // Final chunk
        const finalChunk = {
          id: completionId,
          object: "chat.completion.chunk",
          created,
          model: result.model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: "stop",
            },
          ],
        };
        sendSSE(res, finalChunk);
      }

      // Send usage if requested
      if (includeUsage) {
        const usageChunk = {
          id: completionId,
          object: "chat.completion.chunk",
          created,
          model: result.model,
          choices: [],
          usage: {
            prompt_tokens: result.usage.input_tokens,
            completion_tokens: result.usage.output_tokens,
            total_tokens: totalTokens,
          },
        };
        sendSSE(res, usageChunk);
      }

      // Send [DONE] marker
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      // Non-streaming response
      const message: Record<string, unknown> = {
        role: "assistant",
        content: textContent || null,
      };

      let finishReason = "stop";

      if (shouldUseToolCalls) {
        message.tool_calls = toolCalls;
        finishReason = "tool_calls";
      }

      const response = {
        id: completionId,
        object: "chat.completion",
        created,
        model: result.model,
        choices: [
          {
            index: 0,
            message,
            finish_reason: finishReason,
          },
        ],
        usage: {
          prompt_tokens: result.usage.input_tokens,
          completion_tokens: result.usage.output_tokens,
          total_tokens: totalTokens,
        },
      };

      res.json(response);
    }
  } catch (error: any) {
    console.error("[openai-compat] Error:", error);
    res.status(500).json({
      error: {
        message: error.message || "Internal server error",
        type: "api_error",
      },
    });
  }
});

/**
 * GET /v1/models
 * List available models
 */
router.get("/models", async (_req: Request, res: Response) => {
  res.json({
    object: "list",
    data: [
      {
        id: "deepseek-chat",
        object: "model",
        created: 1700000000,
        owned_by: "operis",
      },
    ],
  });
});

export default router;
