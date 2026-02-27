/**
 * Chat Controller
 * Handles HTTP requests for chat with AI
 */

import type { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { chatMessagesRepo, usersRepo } from "../db/index";
import { tokenService } from "../services/token.service";
import { analyticsService } from "../services/analytics.service";
import { Errors } from "../core/errors/api-error";
import { escapeHtml } from "../utils/sanitize.util";
import { MSG } from "../constants/messages";

class ChatController {
  /**
   * Send a message to AI
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== "string") {
      throw Errors.validation(MSG.MESSAGE_REQUIRED);
    }

    const result = await chatService.sendMessage(req.user!.userId, escapeHtml(message), { conversationId });
    res.json(result);
  }

  /**
   * Get token balance
   */
  async getBalance(req: Request, res: Response): Promise<void> {
    const result = await chatService.getBalance(req.user!.userId);
    res.json(result);
  }

  /**
   * Get list of conversations
   */
  async getConversations(req: Request, res: Response): Promise<void> {
    const conversations = await chatService.getConversations(req.user!.userId);
    res.json({ conversations });
  }

  /**
   * Get conversation history
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    const conversationId = req.params.conversationId as string;

    if (!conversationId) {
      throw Errors.validation(MSG.CONVERSATION_ID_REQUIRED);
    }

    const userId = req.user!.userId;
    const [messages, usage] = await Promise.all([
      chatService.getHistory(userId, conversationId),
      chatMessagesRepo.getConversationUsage(userId, conversationId),
    ]);
    res.json({ messages, usage });
  }

  /**
   * Start a new conversation
   */
  async newConversation(req: Request, res: Response): Promise<void> {
    const result = await chatService.newConversation(req.user!.userId);
    res.json(result);
  }

  /**
   * Save messages + record billing after a gateway WS chat completion.
   * Called by client-web after receiving chat:final from gateway.
   */
  async wsComplete(req: Request, res: Response): Promise<void> {
    const { conversationId, userMessage, assistantMessage, usage } = req.body;
    if (!conversationId || !userMessage || !assistantMessage) {
      throw Errors.validation(MSG.SAVE_HISTORY_FIELDS_REQUIRED);
    }

    const userId = req.user!.userId;
    const MAX_TOKENS = 1_000_000; // Cap to prevent billing abuse
    const inputTokens = Math.min(Math.max(Number(usage?.input_tokens) || 0, 0), MAX_TOKENS);
    const outputTokens = Math.min(Math.max(Number(usage?.output_tokens) || 0, 0), MAX_TOKENS);
    const totalTokens = Math.min(Number(usage?.total_tokens) || inputTokens + outputTokens, MAX_TOKENS);

    // Save user message
    await chatMessagesRepo.createMessage({
      user_id: userId,
      conversation_id: conversationId,
      role: "user",
      content: escapeHtml(userMessage),
    });

    // Save assistant message
    await chatMessagesRepo.createMessage({
      user_id: userId,
      conversation_id: conversationId,
      role: "assistant",
      content: assistantMessage,
      tokens_used: totalTokens,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });

    // Deduct tokens + record analytics
    if (totalTokens > 0) {
      await tokenService.debit(userId, totalTokens, `Chat WS: ${userMessage.slice(0, 30)}...`);
      await analyticsService.recordUsage({
        user_id: userId,
        request_type: "chat",
        request_id: conversationId,
        model: "gateway-agent",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_tokens: totalTokens,
        metadata: { message_preview: userMessage.slice(0, 50), ws: true },
      });
    }

    const updatedUser = await usersRepo.getUserById(userId);
    res.json({ success: true, tokenBalance: updatedUser?.token_balance ?? 0 });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    const conversationId = req.params.conversationId as string;

    if (!conversationId) {
      throw Errors.validation(MSG.CONVERSATION_ID_REQUIRED);
    }

    await chatService.deleteConversation(req.user!.userId, conversationId);
    res.json({ success: true });
  }
}

export const chatController = new ChatController();
