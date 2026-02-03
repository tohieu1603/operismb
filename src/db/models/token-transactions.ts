/**
 * Token Transaction Repository
 * CRUD operations for token_transactions table
 */

import { query, queryOne, queryAll, transaction } from "../connection.js";
import type { TokenTransaction, TokenTransactionCreate, User } from "./types.js";

/**
 * Create a new transaction
 */
export async function createTransaction(data: TokenTransactionCreate): Promise<TokenTransaction> {
  const result = await queryOne<TokenTransaction>(
    `INSERT INTO token_transactions (
      user_id, type, amount, balance_after, description, reference_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      data.user_id,
      data.type,
      data.amount,
      data.balance_after,
      data.description ?? null,
      data.reference_id ?? null,
    ],
  );

  if (!result) {
    throw new Error("Failed to create transaction");
  }

  return result;
}

/**
 * Get transaction by ID
 */
export async function getTransactionById(id: string): Promise<TokenTransaction | null> {
  return queryOne<TokenTransaction>("SELECT * FROM token_transactions WHERE id = $1", [id]);
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

  const conditions: string[] = ["user_id = $1"];
  const params: unknown[] = [userId];
  let paramIndex = 2;

  if (options.type) {
    conditions.push(`type = $${paramIndex}`);
    params.push(options.type);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM token_transactions ${whereClause}`,
    params,
  );

  const transactions = await queryAll<TokenTransaction>(
    `SELECT * FROM token_transactions ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  return {
    transactions,
    total: parseInt(countResult?.count ?? "0", 10),
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
  return transaction(async (client) => {
    // Update user balance
    const userResult = await client.query<User>(
      `UPDATE users
       SET token_balance = token_balance + $1
       WHERE id = $2
       RETURNING *`,
      [amount, userId],
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult.rows[0];

    // Create transaction record
    const txResult = await client.query<TokenTransaction>(
      `INSERT INTO token_transactions (
        user_id, type, amount, balance_after, description, reference_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [userId, "credit", amount, user.token_balance, description, referenceId],
    );

    return {
      user,
      transaction: txResult.rows[0],
    };
  });
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
  return transaction(async (client) => {
    // Check balance first
    const checkResult = await client.query<{ token_balance: number }>(
      "SELECT token_balance FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );

    if (checkResult.rows.length === 0) {
      throw new Error("User not found");
    }

    if (checkResult.rows[0].token_balance < amount) {
      throw new Error("Insufficient token balance");
    }

    // Update user balance
    const userResult = await client.query<User>(
      `UPDATE users
       SET token_balance = token_balance - $1
       WHERE id = $2
       RETURNING *`,
      [amount, userId],
    );

    const user = userResult.rows[0];

    // Create transaction record
    const txResult = await client.query<TokenTransaction>(
      `INSERT INTO token_transactions (
        user_id, type, amount, balance_after, description, reference_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [userId, "debit", amount, user.token_balance, description, referenceId],
    );

    return {
      user,
      transaction: txResult.rows[0],
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
  return transaction(async (client) => {
    // Update user balance
    const userResult = await client.query<User>(
      `UPDATE users
       SET token_balance = token_balance + $1
       WHERE id = $2
       RETURNING *`,
      [amount, userId],
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult.rows[0];

    // Create transaction record
    const txResult = await client.query<TokenTransaction>(
      `INSERT INTO token_transactions (
        user_id, type, amount, balance_after, description
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, "adjustment", Math.abs(amount), user.token_balance, description],
    );

    return {
      user,
      transaction: txResult.rows[0],
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

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.type) {
    conditions.push(`t.type = $${paramIndex}`);
    params.push(options.type);
    paramIndex++;
  }

  if (options.userId) {
    conditions.push(`t.user_id = $${paramIndex}`);
    params.push(options.userId);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM token_transactions t ${whereClause}`,
    params,
  );

  const transactions = await queryAll<TokenTransaction & { user_email: string; user_name: string }>(
    `SELECT t.*, u.email as user_email, u.name as user_name
     FROM token_transactions t
     JOIN users u ON t.user_id = u.id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  return {
    transactions,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

export default {
  createTransaction,
  getTransactionById,
  listTransactionsByUserId,
  listAllTransactions,
  creditTokens,
  debitTokens,
  adjustTokens,
};
