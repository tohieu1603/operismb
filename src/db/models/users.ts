/**
 * User Repository
 * CRUD operations for users table (Operis admin users)
 */

import { query, queryOne, queryAll } from "../connection.js";
import type { User, UserCreate, UserUpdate } from "./types.js";

/**
 * Create a new user
 */
export async function createUser(data: UserCreate): Promise<User> {
  const result = await queryOne<User>(
    `INSERT INTO users (
      email, password_hash, name, role, token_balance
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      data.email.toLowerCase(),
      data.password_hash,
      data.name,
      data.role ?? "user",
      data.token_balance ?? 1000000,
    ],
  );

  if (!result) {
    throw new Error("Failed to create user");
  }

  return result;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE id = $1", [id]);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
}

/**
 * Update user
 */
export async function updateUser(id: string, data: UserUpdate): Promise<User | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(data.email.toLowerCase());
  }
  if (data.password_hash !== undefined) {
    fields.push(`password_hash = $${paramIndex++}`);
    values.push(data.password_hash);
  }
  if (data.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    values.push(data.role);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.is_active);
  }
  if (data.last_active_at !== undefined) {
    fields.push(`last_active_at = $${paramIndex++}`);
    values.push(data.last_active_at);
  }
  if (data.token_balance !== undefined) {
    fields.push(`token_balance = $${paramIndex++}`);
    values.push(data.token_balance);
  }
  if (data.gateway_url !== undefined) {
    fields.push(`gateway_url = $${paramIndex++}`);
    values.push(data.gateway_url);
  }
  if (data.gateway_token !== undefined) {
    fields.push(`gateway_token = $${paramIndex++}`);
    values.push(data.gateway_token);
  }
  if (data.auth_profiles_path !== undefined) {
    fields.push(`auth_profiles_path = $${paramIndex++}`);
    values.push(data.auth_profiles_path);
  }

  if (fields.length === 0) {
    return getUserById(id);
  }

  values.push(id);

  return queryOne<User>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<boolean> {
  const result = await query("DELETE FROM users WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * List all users (with pagination)
 */
export async function listUsers(options: {
  limit?: number;
  offset?: number;
  search?: string;
  role?: string;
  status?: string;
}): Promise<{ users: User[]; total: number }> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.search) {
    conditions.push(`(email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`);
    params.push(`%${options.search}%`);
    paramIndex++;
  }

  if (options.role) {
    conditions.push(`role = $${paramIndex}`);
    params.push(options.role);
    paramIndex++;
  }

  if (options.status) {
    conditions.push(`is_active = $${paramIndex}`);
    params.push(options.status === "active");
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM users ${whereClause}`,
    params,
  );

  const users = await queryAll<User>(
    `SELECT * FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  return {
    users,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * Update user token balance
 */
export async function updateTokenBalance(id: string, amount: number): Promise<User | null> {
  return queryOne<User>(
    `UPDATE users
     SET token_balance = token_balance + $1
     WHERE id = $2
     RETURNING *`,
    [amount, id],
  );
}

/**
 * Check if user has enough tokens
 */
export async function hasEnoughTokens(id: string, amount: number): Promise<boolean> {
  const result = await queryOne<{ has_enough: boolean }>(
    `SELECT token_balance >= $1 as has_enough FROM users WHERE id = $2`,
    [amount, id],
  );
  return result?.has_enough ?? false;
}

export default {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  listUsers,
  updateTokenBalance,
  hasEnoughTokens,
};
