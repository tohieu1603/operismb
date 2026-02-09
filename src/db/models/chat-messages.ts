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
   * Returns the N most recent messages in chronological order
   * (fetch newest first, then reverse to maintain timeline order)
   */
  async getConversationHistory(
    userId: string,
    conversationId: string,
    limit: number = 50,
  ): Promise<ChatMessage[]> {
    // Subquery: get N newest messages, then order by ASC for correct timeline
    return queryAll<ChatMessage>(
      `SELECT * FROM (
         SELECT * FROM chat_messages
         WHERE user_id = $1::uuid AND conversation_id = $2::text
         ORDER BY created_at DESC
         LIMIT $3
       ) sub
       ORDER BY created_at ASC`,
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
       WHERE user_id = $1::uuid AND conversation_id = $2::text`,
      [userId, conversationId],
    );
  }

  /**
   * Get aggregated token usage for a conversation
   */
  async getConversationUsage(
    userId: string,
    conversationId: string,
  ): Promise<{ total_tokens: number; total_cost: number; message_count: number }> {
    const result = await queryOne<{ total_tokens: string; total_cost: string; message_count: string }>(
      `SELECT
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COALESCE(SUM(cost::numeric), 0) as total_cost,
        COUNT(*) as message_count
       FROM chat_messages
       WHERE user_id = $1::uuid AND conversation_id = $2::text`,
      [userId, conversationId],
    );
    return {
      total_tokens: parseInt(result?.total_tokens || "0", 10),
      total_cost: parseFloat(result?.total_cost || "0"),
      message_count: parseInt(result?.message_count || "0", 10),
    };
  }

  /**
   * Count messages in a conversation
   */
  async countMessages(userId: string, conversationId: string): Promise<number> {
    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM chat_messages
       WHERE user_id = $1::uuid AND conversation_id = $2::text`,
      [userId, conversationId],
    );
    return parseInt(result?.count || "0", 10);
  }
}

export const chatMessagesRepo = new ChatMessagesRepo();
