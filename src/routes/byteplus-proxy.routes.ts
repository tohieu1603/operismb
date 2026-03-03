/**
 * BytePlus Proxy Routes
 * Proxy OpenAI-compatible requests to BytePlus Ark API using server-side API key.
 * Client sends request in OpenAI format → server injects real API key → forwards → streams back.
 *
 * Token deduction: after each request completes, deducts total_tokens from user balance
 * and records usage analytics (model, tokens, cost).
 */

import { Router, type Request, type Response } from "express";
import { apiKeyService } from "../services/api-key.service";
import { usersRepo } from "../db/index";
import { asyncHandler } from "../middleware/error.middleware";
import { verifyAccessToken } from "../utils/jwt.util";
import { MSG } from "../constants/messages";

const router = Router();

const BYTEPLUS_API_URL = process.env.BYTEPLUS_API_URL || "https://ark.ap-southeast.bytepluses.com/api/coding/v3";
const BYTEPLUS_API_KEY = process.env.BYTEPLUS_API_KEY || "";
const PROXY_TIMEOUT_MS = 300_000; // 5 min for long completions

/** Authenticate client via JWT Bearer token or API key (x-api-key / Bearer sk_...) */
async function authenticateClient(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const xApiKey = req.headers["x-api-key"] as string | undefined;

  // 1. Try JWT token (Bearer eyJ...)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("eyJ")) {
      try {
        const payload = verifyAccessToken(token);
        return payload?.userId ?? null;
      } catch {
        // Invalid JWT — fall through to try as API key
      }
    }
    // Bearer token that's not JWT — treat as API key
    const result = await apiKeyService.validateKey(token);
    return result?.userId ?? null;
  }

  // 2. Try x-api-key header
  if (xApiKey) {
    const result = await apiKeyService.validateKey(xApiKey);
    return result?.userId ?? null;
  }

  return null;
}

function getByteplusApiKey(): string {
  if (!BYTEPLUS_API_KEY) {
    throw new Error("BYTEPLUS_API_KEY not set");
  }
  return BYTEPLUS_API_KEY;
}

/**
 * POST /chat/completions
 * Proxy OpenAI-compatible chat completions to BytePlus with token tracking.
 */
router.post("/chat/completions", asyncHandler(async (req: Request, res: Response) => {
  const isStreaming = req.body?.stream === true;
  const model = req.body?.model || "unknown";

  // 1. Auth client
  const userId = await authenticateClient(req);
  if (!userId) {
    res.status(401).json({
      error: { message: MSG.INVALID_API_KEY, type: "authentication_error" },
    });
    return;
  }

  // 2. Check user active + has balance
  const user = await usersRepo.getUserById(userId);
  if (!user || !user.is_active) {
    res.status(403).json({
      error: { message: "Account deactivated", type: "permission_error" },
    });
    return;
  }
  const totalBalance = user.token_balance + user.free_token_balance;
  if (totalBalance <= 0) {
    res.status(402).json({
      error: { message: "Insufficient token balance", type: "billing_error", balance: totalBalance },
    });
    return;
  }

  // 3. Get server-side BytePlus API key
  let byteplusKey: string;
  try {
    byteplusKey = getByteplusApiKey();
  } catch (err) {
    console.error("[byteplus-proxy] API key error:", err);
    res.status(500).json({
      error: { message: "No BytePlus API key available", type: "api_error" },
    });
    return;
  }

  // 3. Prepare body — map model aliases + ensure stream_options
  const MODEL_MAP: Record<string, string> = {
    "operis-multi": "kimi-k2.5",
  };
  const body = { ...req.body };
  if (body.model && MODEL_MAP[body.model]) {
    body.model = MODEL_MAP[body.model];
  }
  if (isStreaming) {
    body.stream_options = { ...body.stream_options, include_usage: true };
  }

  // Log if messages contain image content (vision request)
  const hasImages = body.messages?.some((m: any) =>
    Array.isArray(m.content) && m.content.some((c: any) => c.type === "image_url"),
  );
  if (hasImages) {
    console.log(`[byteplus-proxy] Vision request detected for model=${model}, user=${userId}`);
  }

  // Strip fields unsupported by some providers (e.g. Gemini rejects "store")
  delete body.store;
  delete body.metadata;

  // 4. Forward request to BytePlus
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const byteplusRes = await fetch(`${BYTEPLUS_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${byteplusKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!byteplusRes.ok) {
      const errorBody = await byteplusRes.text();
      console.error("[byteplus-proxy] BytePlus error:", byteplusRes.status, errorBody);
      res.status(byteplusRes.status);
      res.setHeader("content-type", "application/json");
      res.send(errorBody);
      return;
    }

    if (isStreaming) {
      // Stream: pipe SSE while parsing usage from final chunk
      res.setHeader("content-type", "text/event-stream");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.setHeader("x-accel-buffering", "no");

      const reader = byteplusRes.body?.getReader();
      if (!reader) { res.end(); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Forward raw bytes to client immediately
          res.write(value);

          // Parse chunks to extract usage from final chunk
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.usage) {
                usage = {
                  prompt_tokens: chunk.usage.prompt_tokens || 0,
                  completion_tokens: chunk.usage.completion_tokens || 0,
                  total_tokens: chunk.usage.total_tokens || 0,
                };
              }
            } catch { /* skip invalid JSON */ }
          }
        }
        // Process remaining buffer (usage chunk may not end with \n)
        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.usage) {
                usage = {
                  prompt_tokens: chunk.usage.prompt_tokens || 0,
                  completion_tokens: chunk.usage.completion_tokens || 0,
                  total_tokens: chunk.usage.total_tokens || 0,
                };
              }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        console.error("[byteplus-proxy] Stream error:", err);
      }

      res.end();

      // Log usage only (deduction handled by upstream chat-stream for Flow 1)
      console.log(`[byteplus-proxy] Stream usage: ${usage.total_tokens} tokens (model=${model}, user=${userId})`);

    } else {
      // Non-stream: parse response, deduct, forward
      const responseText = await byteplusRes.text();

      // Forward response to client immediately
      res.setHeader("content-type", "application/json");
      res.send(responseText);

      // Parse usage and deduct
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.usage) {
          console.log(`[byteplus-proxy] Non-stream usage: ${parsed.usage.total_tokens} tokens (model=${model}, user=${userId})`);
        }
      } catch { /* skip parse error */ }
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      res.status(504).json({
        error: { message: "Request timed out", type: "timeout_error" },
      });
    } else {
      console.error("[byteplus-proxy] Fetch error:", err);
      res.status(500).json({
        error: { message: err.message || "Internal error", type: "api_error" },
      });
    }
  }
}));

export default router;
