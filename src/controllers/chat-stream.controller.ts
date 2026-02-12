/**
 * Chat Stream Controller
 * Handles SSE streaming requests for chat with AI
 */

import type { Request, Response } from "express";
import { chatStreamService } from "../services/chat-stream.service.js";
import { Errors } from "../core/errors/api-error.js";
import { escapeHtml } from "../utils/sanitize.util.js";

class ChatStreamController {
  /**
   * Stream a message response via SSE
   * Note: SSE errors are handled within the service via sendSSE
   */
  async streamMessage(req: Request, res: Response): Promise<void> {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({
        error: "Message is required",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    // Stream handles its own response via SSE
    await chatStreamService.streamMessage(req.user!.userId, escapeHtml(message), res, {
      conversationId,
    });
  }
}

export const chatStreamController = new ChatStreamController();
