/**
 * Anthropic OAuth Proxy Routes
 * Proxy raw requests to api.anthropic.com using server-side OAuth token.
 * Client sends request in Anthropic format → server injects real token → forwards → streams back.
 *
 * OpenClaw clients use this as custom provider baseUrl instead of calling Anthropic directly.
 * Setup token (sk-ant-oat01-*) never leaves the server.
 */

import { Router, type Request, type Response } from "express";
import { apiKeyService } from "../services/api-key.service";
import { settingsRepo } from "../db/models/settings";
import crypto from "node:crypto";

import { asyncHandler } from "../middleware/error.middleware";
import { MSG } from "../constants/messages";

// Debug logging (console only — no file writes in production)
function debugLog(msg: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[anthropic-proxy] ${msg}`);
  }
}

const router = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
// Required beta flag for OAuth token auth
const ANTHROPIC_BETA = "oauth-2025-04-20";
const PROXY_TIMEOUT_MS = 300_000; // 5 min for long completions

const SETTINGS_KEY = "anthropic_oauth_tokens";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  return crypto.createHash("sha256").update(secret).digest();
}

function decrypt(blob: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = blob.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/** Resolve Anthropic OAuth token from vault (round-robin) */
let tokenIndex = 0;
async function getAnthropicToken(): Promise<string> {
  // 1. Try token vault (encrypted in DB)
  const raw = await settingsRepo.getSetting(SETTINGS_KEY);
  if (raw) {
    const encryptedList: string[] = JSON.parse(raw);
    const tokens = encryptedList.map((blob: string) => decrypt(blob));
    if (tokens.length > 0) {
      const token = tokens[tokenIndex % tokens.length];
      tokenIndex++;
      return token;
    }
  }

  // 2. Fallback to env var
  const envToken = process.env.ANTHROPIC_OAUTH_TOKEN;
  if (envToken) return envToken;

  throw new Error("No Anthropic OAuth token configured (vault empty + ANTHROPIC_OAUTH_TOKEN not set)");
}

/** Authenticate client via x-api-key or Bearer token */
async function authenticateClient(req: Request): Promise<string | null> {
  let apiKey = req.headers["x-api-key"] as string | undefined;
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

// Debug: catch all requests to see what URL the SDK sends
router.all("*", (req: Request, _res, next) => {
  const msg = `${req.method} ${req.originalUrl} (path: ${req.path})`;
  console.log(`[anthropic-proxy] ${msg}`);
  debugLog(msg);
  next();
});

/**
 * POST /v1/messages
 * Proxy Anthropic Messages API — streaming + non-streaming
 */
router.post(["/v1/messages", "/messages"], asyncHandler(async (req: Request, res: Response) => {
  const isStreaming = req.body?.stream === true;
  console.log("[anthropic-proxy] Request received, model:", req.body?.model, "stream:", isStreaming);

  // 1. Auth client
  const userId = await authenticateClient(req);
  if (!userId) {
    res.status(401).json({
      type: "error",
      error: { type: "authentication_error", message: MSG.INVALID_API_KEY },
    });
    return;
  }

  // 2. Get server-side Anthropic token
  let anthropicToken: string;
  try {
    anthropicToken = await getAnthropicToken();
  } catch (err) {
    console.error("[anthropic-proxy] Token error:", err);
    res.status(500).json({
      type: "error",
      error: { type: "api_error", message: MSG.NO_ANTHROPIC_TOKEN },
    });
    return;
  }

  // 3. Forward request to Anthropic (raw passthrough)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const anthropicRes = await fetch(`${ANTHROPIC_API_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${anthropicToken}`,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-beta": ANTHROPIC_BETA,
        "content-type": "application/json",
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 4. Forward response headers
    res.status(anthropicRes.status);

    if (!anthropicRes.ok) {
      const errorBody = await anthropicRes.text();
      console.error("[anthropic-proxy] Anthropic error:", anthropicRes.status, errorBody);
      res.setHeader("content-type", "application/json");
      res.send(errorBody);
      return;
    }

    if (isStreaming) {
      // 5a. Stream: pipe SSE directly from Anthropic → client (zero conversion)
      res.setHeader("content-type", "text/event-stream");
      res.setHeader("cache-control", "no-cache");
      res.setHeader("connection", "keep-alive");

      const reader = anthropicRes.body?.getReader();
      if (!reader) {
        res.end();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (err) {
        console.error("[anthropic-proxy] Stream error:", err);
      }
      res.end();
    } else {
      // 5b. Non-stream: forward JSON response as-is
      res.setHeader("content-type", "application/json");
      const body = await anthropicRes.text();
      res.send(body);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      res.status(504).json({
        type: "error",
        error: { type: "timeout_error", message: "Request timed out" },
      });
    } else {
      console.error("[anthropic-proxy] Fetch error:", err);
      res.status(502).json({
        type: "error",
        error: { type: "api_error", message: "Service temporarily unavailable." },
      });
    }
  }
}));

// ─── OpenAI ↔ Anthropic format conversion helpers ───

type OaiMsg = { role: string; content?: unknown; tool_calls?: unknown[]; tool_call_id?: string; name?: string; [k: string]: unknown };
type AnthropicMsg = { role: string; content: unknown };

/** Extract system prompt and convert OpenAI messages → Anthropic messages */
function convertOaiToAnthropicMessages(oaiMessages: OaiMsg[]): { system: string; messages: AnthropicMsg[] } {
  let system = "";
  const messages: AnthropicMsg[] = [];

  for (const msg of oaiMessages) {
    if (msg.role === "system" || msg.role === "developer") {
      // Anthropic uses top-level `system` param
      system += (system ? "\n\n" : "") + String(msg.content ?? "");
      continue;
    }

    if (msg.role === "user") {
      messages.push({ role: "user", content: typeof msg.content === "string" ? msg.content : msg.content ?? "" });
      continue;
    }

    if (msg.role === "assistant") {
      const content: unknown[] = [];
      // Text content
      if (msg.content) {
        content.push({ type: "text", text: String(msg.content) });
      }
      // Tool calls → tool_use blocks
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>) {
          let input = {};
          try { input = JSON.parse(tc.function.arguments); } catch {}
          content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
        }
      }
      messages.push({ role: "assistant", content: content.length === 1 && typeof content[0] === "object" && (content[0] as { type: string }).type === "text" ? (content[0] as { text: string }).text : content });
      continue;
    }

    if (msg.role === "tool") {
      // Tool result → user message with tool_result block
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: msg.tool_call_id, content: String(msg.content ?? "") }],
      });
      continue;
    }
  }
  return { system, messages };
}

/** Convert OpenAI tools → Anthropic tools format */
function convertOaiTools(tools?: Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>): unknown[] | undefined {
  if (!tools?.length) return undefined;
  return tools
    .filter((t) => t.type === "function")
    .map((t) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      input_schema: t.function.parameters ?? { type: "object", properties: {} },
    }));
}

/** Map Anthropic stop_reason → OpenAI finish_reason */
function mapStopReason(reason: string | null): string {
  if (reason === "tool_use") return "tool_calls";
  if (reason === "max_tokens") return "length";
  return "stop";
}

/** Convert Anthropic non-streaming response → OpenAI chat completion format */
function convertAnthropicToOaiResponse(data: {
  id: string; model: string; content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  stop_reason: string | null; usage?: { input_tokens?: number; output_tokens?: number };
}, requestModel: string): unknown {
  let textContent = "";
  const toolCalls: unknown[] = [];
  let toolIdx = 0;

  for (const block of data.content ?? []) {
    if (block.type === "text") {
      textContent += block.text ?? "";
    } else if (block.type === "tool_use") {
      toolCalls.push({
        index: toolIdx,
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
      toolIdx++;
    }
  }

  return {
    id: data.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestModel,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textContent || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: mapStopReason(data.stop_reason),
    }],
    usage: {
      prompt_tokens: data.usage?.input_tokens ?? 0,
      completion_tokens: data.usage?.output_tokens ?? 0,
      total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    },
  };
}

/**
 * POST /chat/completions
 * OpenAI-compatible endpoint — converts OpenAI format ↔ Anthropic, proxies via OAuth
 */
router.post("/chat/completions", asyncHandler(async (req: Request, res: Response) => {
  const isStreaming = req.body?.stream === true;
  const requestModel = req.body?.model ?? "claude-sonnet-4-5";
  console.log("[anthropic-proxy] OpenAI-compat request, model:", requestModel, "stream:", isStreaming);

  // 1. Auth
  const userId = await authenticateClient(req);
  if (!userId) {
    res.status(401).json({ error: { message: MSG.INVALID_API_KEY, type: "authentication_error" } });
    return;
  }

  // 2. Get Anthropic token
  let anthropicToken: string;
  try {
    anthropicToken = await getAnthropicToken();
  } catch (err) {
    res.status(500).json({ error: { message: MSG.NO_ANTHROPIC_TOKEN, type: "api_error" } });
    return;
  }

  // 3. Convert OpenAI → Anthropic format
  const { system, messages } = convertOaiToAnthropicMessages(req.body.messages ?? []);
  const tools = convertOaiTools(req.body.tools);

  const anthropicBody: Record<string, unknown> = {
    model: requestModel,
    messages,
    max_tokens: req.body.max_tokens ?? req.body.max_completion_tokens ?? 8192,
    stream: isStreaming,
  };
  if (system) anthropicBody.system = system;
  if (tools) anthropicBody.tools = tools;
  if (req.body.temperature != null) anthropicBody.temperature = req.body.temperature;
  if (req.body.top_p != null) anthropicBody.top_p = req.body.top_p;

  debugLog(`→ Anthropic, model=${requestModel}, msgs=${messages.length}, tools=${tools?.length ?? 0}, system=${system.length}chars, stream=${isStreaming}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const anthropicRes = await fetch(`${ANTHROPIC_API_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${anthropicToken}`,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-beta": ANTHROPIC_BETA,
        "content-type": "application/json",
      },
      body: JSON.stringify(anthropicBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    debugLog(`← Anthropic status=${anthropicRes.status}`);

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      debugLog(`← Anthropic ERROR: ${errText.slice(0, 500)}`);
      // Forward error in OpenAI format
      res.status(anthropicRes.status).json({
        error: { message: `Anthropic API error: ${errText.slice(0, 200)}`, type: "api_error" },
      });
      return;
    }

    if (!isStreaming) {
      // Non-streaming: convert Anthropic JSON → OpenAI JSON
      const data = await anthropicRes.json() as any;
      const oaiResponse = convertAnthropicToOaiResponse(data, requestModel);
      res.setHeader("content-type", "application/json");
      res.json(oaiResponse);
    } else {
      // Streaming: parse Anthropic SSE → emit OpenAI SSE chunks
      res.setHeader("content-type", "text/event-stream");
      res.setHeader("cache-control", "no-cache");
      res.setHeader("connection", "keep-alive");

      const reader = anthropicRes.body?.getReader();
      if (!reader) { res.end(); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let msgId = "";
      // Track tool_use blocks for streaming tool_calls conversion
      let toolCallIndex = 0;
      let sentRole = false;

      const sendChunk = (delta: Record<string, unknown>, finishReason: string | null = null) => {
        const chunk = {
          id: msgId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: requestModel,
          choices: [{ index: 0, delta, finish_reason: finishReason }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            if (!jsonStr.trim()) continue;

            let evt: any;
            try { evt = JSON.parse(jsonStr); } catch { continue; }

            if (evt.type === "message_start") {
              msgId = evt.message?.id ?? `chatcmpl-${Date.now()}`;
              if (!sentRole) {
                sendChunk({ role: "assistant" });
                sentRole = true;
              }
            } else if (evt.type === "content_block_start") {
              const block = evt.content_block;
              if (block?.type === "tool_use") {
                // Start of a tool_call
                sendChunk({
                  tool_calls: [{
                    index: toolCallIndex,
                    id: block.id,
                    type: "function",
                    function: { name: block.name, arguments: "" },
                  }],
                });
              }
            } else if (evt.type === "content_block_delta") {
              const delta = evt.delta;
              if (delta?.type === "text_delta" && delta.text) {
                sendChunk({ content: delta.text });
              } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                sendChunk({
                  tool_calls: [{
                    index: toolCallIndex,
                    function: { arguments: delta.partial_json },
                  }],
                });
              }
            } else if (evt.type === "content_block_stop") {
              // If this was a tool_use block, advance index
              if (evt.index != null && toolCallIndex <= evt.index) {
                toolCallIndex = evt.index + 1;
              }
            } else if (evt.type === "message_delta") {
              const finishReason = mapStopReason(evt.delta?.stop_reason ?? null);
              sendChunk({}, finishReason);
            }

          }
        }
      } catch (err) {
        console.error("[anthropic-proxy] Stream conversion error:", err);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    res.status(err.name === "AbortError" ? 504 : 502).json({
      error: { message: err.name === "AbortError" ? "Request timed out." : "Service temporarily unavailable.", type: "api_error" },
    });
  }
}));

export default router;
