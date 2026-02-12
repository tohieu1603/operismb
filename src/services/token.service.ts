/**
 * Token Service - Token balance and transactions
 */

import { usersRepo, tokenTransactionsRepo, tokenUsageRepo } from "../db/index";
import { Errors } from "../core/errors/api-error";
import { sanitizeUser } from "../utils/sanitize.util";
import type { SafeUser, TokenTransaction } from "../core/types/entities";
import type { RequestType } from "../db/models/types";

export interface TransactionResult {
  user: SafeUser;
  transaction: TokenTransaction;
}

export interface PaginatedTransactions {
  transactions: TokenTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class TokenService {
  async getBalance(userId: string): Promise<number> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    return user.token_balance;
  }

  async getTransactions(
    userId: string,
    page: number,
    limit: number,
    type?: string,
  ): Promise<PaginatedTransactions> {
    const result = await tokenTransactionsRepo.listTransactionsByUserId(userId, {
      limit,
      offset: (page - 1) * limit,
      type,
    });

    return {
      transactions: result.transactions,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async credit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<TransactionResult> {
    const result = await tokenTransactionsRepo.creditTokens(
      userId,
      amount,
      description,
      referenceId,
    );
    return { user: sanitizeUser(result.user), transaction: result.transaction };
  }

  async debit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<TransactionResult> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    if (user.token_balance < amount) {
      throw Errors.insufficientBalance(user.token_balance, amount);
    }

    const result = await tokenTransactionsRepo.debitTokens(
      userId,
      amount,
      description,
      referenceId,
    );
    return { user: sanitizeUser(result.user), transaction: result.transaction };
  }

  async getTransactionHistory(userId: string, limit = 50, offset = 0): Promise<TokenTransaction[]> {
    const result = await tokenTransactionsRepo.listTransactionsByUserId(userId, { limit, offset });
    return result.transactions;
  }

  async adjust(userId: string, amount: number, description: string): Promise<TransactionResult> {
    const result = await tokenTransactionsRepo.adjustTokens(userId, amount, description);
    return { user: sanitizeUser(result.user), transaction: result.transaction };
  }

  /**
   * Deduct tokens after AI usage: record usage analytics + debit from balance
   */
  async deductUsage(
    userId: string,
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      model?: string;
      request_type?: RequestType;
      request_id?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ balance: number; deducted: number; usage_id: string }> {
    const costTokens = usage.total_tokens;
    if (costTokens <= 0) {
      throw Errors.badRequest("total_tokens must be greater than 0");
    }

    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    if (user.token_balance < costTokens) {
      throw Errors.insufficientBalance(user.token_balance, costTokens);
    }

    // 1) Record usage analytics
    const usageRecord = await tokenUsageRepo.recordUsage({
      user_id: userId,
      request_type: usage.request_type ?? "chat",
      request_id: usage.request_id,
      model: usage.model,
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      cost_tokens: costTokens,
      metadata: usage.metadata,
    });

    // 2) Debit from balance + create transaction
    const result = await tokenTransactionsRepo.debitTokens(
      userId,
      costTokens,
      `AI usage: ${usage.prompt_tokens} in + ${usage.completion_tokens} out = ${usage.total_tokens} tokens`,
      usageRecord.id,
    );

    return {
      balance: result.user.token_balance,
      deducted: costTokens,
      usage_id: usageRecord.id,
    };
  }

  async getAllTransactions(
    page: number,
    limit: number,
    type?: string,
    userId?: string,
  ): Promise<{
    transactions: (TokenTransaction & { user_email: string; user_name: string })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await tokenTransactionsRepo.listAllTransactions({
      limit,
      offset: (page - 1) * limit,
      type,
      userId,
    });

    return {
      transactions: result.transactions,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}

export const tokenService = new TokenService();
