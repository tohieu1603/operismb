/**
 * Token Transaction Repository
 * CRUD operations for token_transactions table
 * Migrated to TypeORM from raw SQL
 */

import { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source.js";
import { TokenTransactionEntity } from "../entities/token-transaction.entity.js";
import { UserEntity } from "../entities/user.entity.js";
import type { TokenTransaction, TokenTransactionCreate, User } from "./types.js";

/**
 * Create a new transaction
 */
export async function createTransaction(data: TokenTransactionCreate): Promise<TokenTransaction> {
  const repo = AppDataSource.getRepository(TokenTransactionEntity);

  const transaction = repo.create({
    user_id: data.user_id,
    type: data.type,
    amount: data.amount,
    balance_after: data.balance_after,
    description: data.description ?? null,
    reference_id: data.reference_id ?? null,
  });

  const saved = await repo.save(transaction);

  return saved as unknown as TokenTransaction;
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(id: string): Promise<TokenTransaction | null> {
  const repo = AppDataSource.getRepository(TokenTransactionEntity);
  const transaction = await repo.findOneBy({ id });

  return transaction ? (transaction as unknown as TokenTransaction) : null;
}

/**
 * List transactions for a user (with pagination)
 */
export async function listTransactionsByUserId(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
  } = {},
): Promise<{ transactions: TokenTransaction[]; total: number }> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const repo = AppDataSource.getRepository(TokenTransactionEntity);
  const qb = repo.createQueryBuilder("t").where("t.user_id = :userId", { userId });

  if (options.type) {
    qb.andWhere("t.type = :type", { type: options.type });
  }

  const total = await qb.getCount();

  const transactions = await qb
    .orderBy("t.created_at", "DESC")
    .skip(offset)
    .take(limit)
    .getMany();

  return {
    transactions: transactions as unknown as TokenTransaction[],
    total,
  };
}

/**
 * Credit tokens to user (add)
 */
export async function creditTokens(
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string,
): Promise<{ user: User; transaction: TokenTransaction }> {
  return AppDataSource.transaction(async (manager) => {
    // Update user balance
    await manager
      .createQueryBuilder()
      .update(UserEntity)
      .set({ token_balance: () => "token_balance + :amount" })
      .setParameter("amount", amount)
      .where("id = :id", { id: userId })
      .execute();

    const user = await manager.findOneByOrFail(UserEntity, { id: userId });

    // Create transaction record
    const tx = manager.create(TokenTransactionEntity, {
      user_id: userId,
      type: "credit",
      amount,
      balance_after: user.token_balance,
      description: description ?? null,
      reference_id: referenceId ?? null,
    });
    const saved = await manager.save(TokenTransactionEntity, tx);

    return {
      user: user as unknown as User,
      transaction: saved as unknown as TokenTransaction,
    };
  });
}

/**
 * Credit tokens using an existing DB client (for external transaction control).
 * Same logic as creditTokens but caller owns the transaction.
 */
export async function creditTokensWithClient(
  manager: EntityManager,
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string,
): Promise<{ user: User; transaction: TokenTransaction }> {
  // Update user balance
  await manager
    .createQueryBuilder()
    .update(UserEntity)
    .set({ token_balance: () => "token_balance + :amount" })
    .setParameter("amount", amount)
    .where("id = :id", { id: userId })
    .execute();

  const user = await manager.findOneByOrFail(UserEntity, { id: userId });

  // Create transaction record
  const tx = manager.create(TokenTransactionEntity, {
    user_id: userId,
    type: "credit",
    amount,
    balance_after: user.token_balance,
    description: description ?? null,
    reference_id: referenceId ?? null,
  });
  const saved = await manager.save(TokenTransactionEntity, tx);

  return {
    user: user as unknown as User,
    transaction: saved as unknown as TokenTransaction,
  };
}

/**
 * Debit tokens from user (subtract)
 */
export async function debitTokens(
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string,
): Promise<{ user: User; transaction: TokenTransaction }> {
  return AppDataSource.transaction(async (manager) => {
    // Check balance first with pessimistic locking (FOR UPDATE)
    const userRow = await manager
      .createQueryBuilder(UserEntity, "u")
      .setLock("pessimistic_write")
      .where("u.id = :id", { id: userId })
      .getOne();

    if (!userRow) {
      throw new Error("User not found");
    }

    if (userRow.token_balance < amount) {
      throw new Error("Insufficient token balance");
    }

    // Update user balance
    await manager
      .createQueryBuilder()
      .update(UserEntity)
      .set({ token_balance: () => "token_balance - :amount" })
      .setParameter("amount", amount)
      .where("id = :id", { id: userId })
      .execute();

    const user = await manager.findOneByOrFail(UserEntity, { id: userId });

    // Create transaction record
    const tx = manager.create(TokenTransactionEntity, {
      user_id: userId,
      type: "debit",
      amount,
      balance_after: user.token_balance,
      description: description ?? null,
      reference_id: referenceId ?? null,
    });
    const saved = await manager.save(TokenTransactionEntity, tx);

    return {
      user: user as unknown as User,
      transaction: saved as unknown as TokenTransaction,
    };
  });
}

/**
 * Adjust tokens (admin operation)
 */
export async function adjustTokens(
  userId: string,
  amount: number, // can be positive or negative
  description?: string,
): Promise<{ user: User; transaction: TokenTransaction }> {
  return AppDataSource.transaction(async (manager) => {
    // Update user balance
    await manager
      .createQueryBuilder()
      .update(UserEntity)
      .set({ token_balance: () => "token_balance + :amount" })
      .setParameter("amount", amount)
      .where("id = :id", { id: userId })
      .execute();

    const user = await manager.findOneByOrFail(UserEntity, { id: userId });

    // Create transaction record
    const tx = manager.create(TokenTransactionEntity, {
      user_id: userId,
      type: "adjustment",
      amount: Math.abs(amount),
      balance_after: user.token_balance,
      description: description ?? null,
      reference_id: null,
    });
    const saved = await manager.save(TokenTransactionEntity, tx);

    return {
      user: user as unknown as User,
      transaction: saved as unknown as TokenTransaction,
    };
  });
}

/**
 * List all transactions (admin) with user info
 */
export async function listAllTransactions(
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    userId?: string;
  } = {},
): Promise<{
  transactions: (TokenTransaction & { user_email: string; user_name: string })[];
  total: number;
}> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const qb = AppDataSource.createQueryBuilder(TokenTransactionEntity, "t")
    .leftJoin("t.user", "u")
    .select("t.id", "id")
    .addSelect("t.user_id", "user_id")
    .addSelect("t.type", "type")
    .addSelect("t.amount", "amount")
    .addSelect("t.balance_after", "balance_after")
    .addSelect("t.description", "description")
    .addSelect("t.reference_id", "reference_id")
    .addSelect("t.created_at", "created_at")
    .addSelect("u.email", "user_email")
    .addSelect("u.name", "user_name");

  if (options.type) {
    qb.andWhere("t.type = :type", { type: options.type });
  }

  if (options.userId) {
    qb.andWhere("t.user_id = :userId", { userId: options.userId });
  }

  const total = await qb.getCount();

  const transactions = await qb
    .orderBy("t.created_at", "DESC")
    .skip(offset)
    .take(limit)
    .getRawMany();

  return {
    transactions: transactions as (TokenTransaction & { user_email: string; user_name: string })[],
    total,
  };
}

export default {
  createTransaction,
  getTransactionById,
  listTransactionsByUserId,
  listAllTransactions,
  creditTokens,
  creditTokensWithClient,
  debitTokens,
  adjustTokens,
};
