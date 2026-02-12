/**
 * Gateway Proxy Controller
 * Handles proxy requests từ Operis API đến user's Moltbot Gateway
 */

import type { Request, Response } from "express";
import { gatewayProxyService } from "../services/gateway-proxy.service";

// ============================================
// Controller Functions
// ============================================

/**
 * POST /api/v1/gateway/wake
 * Inject system event vào main session
 */
export async function wakeHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const { text, mode } = req.body;

    const result = await gatewayProxyService.wake(userId, { text, mode });

    res.status(200).json(result);
  } catch (error: any) {
    console.error("[gateway-proxy] Wake error:", error.message);
    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/v1/gateway/agent
 * Chạy agent turn với delivery options
 */
export async function agentHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const {
      message,
      name,
      wakeMode,
      sessionKey,
      deliver,
      channel,
      to,
      model,
      thinking,
      timeoutSeconds,
    } = req.body;

    const result = await gatewayProxyService.agent(userId, {
      message,
      name,
      wakeMode,
      sessionKey,
      deliver,
      channel,
      to,
      model,
      thinking,
      timeoutSeconds,
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error("[gateway-proxy] Agent error:", error.message);
    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/v1/gateway/hooks/:hookName
 * Forward custom webhook đến gateway
 */
export async function customHookHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const { hookName } = req.params;
    if (!hookName) {
      res.status(400).json({ ok: false, error: "hookName is required" });
      return;
    }

    const result = await gatewayProxyService.customHook(userId, hookName, req.body);

    res.status(200).json(result);
  } catch (error: any) {
    console.error("[gateway-proxy] Custom hook error:", error.message);
    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/v1/gateway/responses
 * OpenResponses API - Full-featured AI API
 */
export async function responsesHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const { model, input, stream, tools, tool_choice, instructions, metadata } = req.body;

    // Check if streaming
    if (stream === true) {
      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Stream events
      await gatewayProxyService.responses(
        userId,
        { model, input, stream: true, tools, tool_choice, instructions, metadata },
        (eventType, data) => {
          if (eventType === "done") {
            res.write("event: done\ndata: [DONE]\n\n");
            res.end();
          } else {
            res.write(`event: ${eventType}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          }
        }
      );
    } else {
      // Non-streaming
      const result = await gatewayProxyService.responses(userId, {
        model,
        input,
        stream: false,
        tools,
        tool_choice,
        instructions,
        metadata,
      });

      res.status(200).json(result);
    }
  } catch (error: any) {
    console.error("[gateway-proxy] Responses error:", error.message);

    // If headers already sent (streaming), just end
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
      return;
    }

    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/v1/gateway/tools/invoke
 * Direct tool invocation
 */
export async function invokeToolHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const { tool, parameters } = req.body;

    if (!tool) {
      res.status(400).json({ ok: false, error: "tool is required" });
      return;
    }

    const result = await gatewayProxyService.invokeTools(userId, tool, parameters || {});

    res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("[gateway-proxy] Invoke tool error:", error.message);
    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * GET /api/v1/gateway/health
 * Check gateway connection
 */
export async function healthHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const result = await gatewayProxyService.healthCheck(userId);

    res.status(200).json(result);
  } catch (error: any) {
    console.error("[gateway-proxy] Health check error:", error.message);
    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

/**
 * POST /api/v1/gateway/chat/completions
 * OpenAI-compatible chat completions - returns full response
 */
export async function chatCompletionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const { model, messages, stream, max_tokens, temperature } = req.body;

    const result = await gatewayProxyService.chatCompletions(userId, {
      model,
      messages,
      stream,
      max_tokens,
      temperature,
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error("[gateway-proxy] Chat completions error:", error.message);
    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

export const gatewayProxyController = {
  wake: wakeHandler,
  agent: agentHandler,
  customHook: customHookHandler,
  responses: responsesHandler,
  invokeTool: invokeToolHandler,
  health: healthHandler,
  chatCompletions: chatCompletionsHandler,
};
