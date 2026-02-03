/**
 * Chat Messages Repository
 * CRUD operations for chat history in PostgreSQL
 */

import { query, queryOne, queryAll } from "../connection.js";

export interface ChatMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  provider?: string;
  tokens_used?: number;
  cost?: number;
  created_at: Date;
}

export interface CreateMessageInput {
  user_id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  provider?: string;
  tokens_used?: number;
  cost?: number;
}

class ChatMessagesRepo {
  /**
   * Save a message to the database
   */
  async createMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const result = await queryOne<ChatMessage>(
      `INSERT INTO chat_messages 
        (user_id, conversation_id, role, content, model, provider, tokens_used, cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.user_id,
        input.conversation_id,
        input.role,
        input.content,
        input.model || null,
        input.provider || null,
        input.tokens_used || 0,
        input.cost || 0,
      ],
    );
    return result!;
  }

  /**
   * Get conversation history for a user
   * Returns messages in chronological order
   */
  async getConversationHistory(
    userId: string,
    conversationId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    return queryAll<ChatMessage>(
      `SELECT * FROM chat_messages 
       WHERE user_id = $1 AND conversation_id = $2
       ORDER BY created_at ASC
       LIMIT $3`,
      [userId, conversationId, limit],
    );
  }

  /**
   * Get the latest conversation for a user
   * (to continue where they left off)
   */
  async getLatestConversationId(userId: string): Promise<string | null> {
    const result = await queryOne<{ conversation_id: string }>(
      `SELECT conversation_id FROM chat_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    return result?.conversation_id || null;
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(
    userId: string,
    limit: number = 20,
  ): Promise<{ conversation_id: string; last_message: string; created_at: Date }[]> {
    return queryAll(
      `SELECT DISTINCT ON (conversation_id) 
        conversation_id, 
        content as last_message, 
        created_at
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY conversation_id, created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await query(
      `DELETE FROM chat_messages 
       WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId],
    );
  }

  /**
   * Count messages in a conversation
   */
  async countMessages(userId: string, conversationId: string): Promise<number> {
    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM chat_messages 
       WHERE user_id = $1 AND conversation_id = $2`,
      [userId, conversationId],
    );
    return parseInt(result?.count || "0", 10);
  }
}

export const chatMessagesRepo = new ChatMessagesRepo();
