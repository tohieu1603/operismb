/**
 * Chat Messages Repository
 * CRUD operations for chat history using TypeORM
 */

import { AppDataSource } from "../data-source";
import { ChatMessageEntity } from "../entities/chat-message.entity";

export interface ChatMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  provider?: string;
  tokens_used?: number;
  input_tokens?: number;
  output_tokens?: number;
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
  input_tokens?: number;
  output_tokens?: number;
  cost?: number;
}

function getRepo() {
  return AppDataSource.getRepository(ChatMessageEntity);
}

class ChatMessagesRepo {
  /**
   * Save a message to the database
   */
  async createMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const message = getRepo().create({
      user_id: input.user_id,
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      model: input.model || null,
      provider: input.provider || null,
      tokens_used: input.tokens_used || 0,
      input_tokens: input.input_tokens || 0,
      output_tokens: input.output_tokens || 0,
      cost: input.cost !== undefined ? String(input.cost) : null,
    });
    const saved = await getRepo().save(message);
    return saved as unknown as ChatMessage;
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
    // Use raw query to handle subquery with ORDER DESC then ASC
    const messages = await AppDataSource.query(
      `SELECT * FROM (
         SELECT * FROM chat_messages
         WHERE user_id = $1::uuid AND conversation_id = $2
         ORDER BY created_at DESC
         LIMIT $3
       ) sub
       ORDER BY created_at ASC`,
      [userId, conversationId, limit],
    );
    return messages as ChatMessage[];
  }

  /**
   * Get the latest conversation for a user
   * (to continue where they left off)
   */
  async getLatestConversationId(userId: string): Promise<string | null> {
    const result = await getRepo()
      .createQueryBuilder("msg")
      .select("msg.conversation_id")
      .where("msg.user_id = :userId", { userId })
      .orderBy("msg.created_at", "DESC")
      .limit(1)
      .getRawOne<{ msg_conversation_id: string }>();

    return result?.msg_conversation_id || null;
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(
    userId: string,
    limit: number = 20,
  ): Promise<{ conversation_id: string; last_message: string; created_at: Date }[]> {
    // Use raw query for DISTINCT ON (PostgreSQL-specific)
    const results = await AppDataSource.query(
      `SELECT DISTINCT ON (conversation_id)
        conversation_id,
        content as last_message,
        created_at
       FROM chat_messages
       WHERE user_id = $1::uuid
       ORDER BY conversation_id, created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return results;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await getRepo()
      .createQueryBuilder()
      .delete()
      .from(ChatMessageEntity)
      .where("user_id = :userId", { userId })
      .andWhere("conversation_id = :conversationId", { conversationId })
      .execute();
  }

  /**
   * Get aggregated token usage for a conversation
   */
  async getConversationUsage(
    userId: string,
    conversationId: string,
  ): Promise<{ total_tokens: number; total_cost: number; message_count: number }> {
    const result = await getRepo()
      .createQueryBuilder("msg")
      .select("COALESCE(SUM(msg.tokens_used), 0)", "total_tokens")
      .addSelect("COALESCE(SUM(msg.cost::numeric), 0)", "total_cost")
      .addSelect("COUNT(*)", "message_count")
      .where("msg.user_id = :userId", { userId })
      .andWhere("msg.conversation_id = :conversationId", { conversationId })
      .getRawOne<{ total_tokens: string; total_cost: string; message_count: string }>();

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
    const count = await getRepo()
      .createQueryBuilder("msg")
      .where("msg.user_id = :userId", { userId })
      .andWhere("msg.conversation_id = :conversationId", { conversationId })
      .getCount();

    return count;
  }
}

export const chatMessagesRepo = new ChatMessagesRepo();
