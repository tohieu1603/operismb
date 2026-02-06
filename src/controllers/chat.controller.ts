/**
 * Chat Controller
 * Handles HTTP requests for chat with AI
 */

import type { Request, Response } from "express";
import { chatService } from "../services/chat.service.js";
import { chatMessagesRepo } from "../db/index.js";
import { Errors } from "../core/errors/api-error.js";

class ChatController {
  /**
   * Send a message to AI
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== "string") {
      throw Errors.validation("Message is required");
    }

    const result = await chatService.sendMessage(req.user!.userId, message, { conversationId });
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
      throw Errors.validation("Conversation ID is required");
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
   * Delete a conversation
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    const conversationId = req.params.conversationId as string;

    if (!conversationId) {
      throw Errors.validation("Conversation ID is required");
    }

    await chatService.deleteConversation(req.user!.userId, conversationId);
    res.json({ success: true });
  }
}

export const chatController = new ChatController();
