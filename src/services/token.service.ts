/**
 * Token Service - Token balance and transactions
 */

import { usersRepo, tokenTransactionsRepo } from "../db/index.js";
import { Errors } from "../core/errors/api-error.js";
import { sanitizeUser } from "../utils/sanitize.util.js";
import type { SafeUser, TokenTransaction } from "../core/types/entities.js";

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
