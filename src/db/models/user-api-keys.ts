/**
 * User API Key Repository
 * CRUD operations for user_api_keys table
 */

import { query, queryOne, queryAll } from "../connection.js";
import type { UserApiKey, UserApiKeyCreate, UserApiKeyUpdate } from "./types.js";

/**
 * Create a new API key
 */
export async function createApiKey(data: UserApiKeyCreate): Promise<UserApiKey> {
  const result = await queryOne<UserApiKey>(
    `INSERT INTO user_api_keys (
      user_id, key_hash, key_prefix, name, permissions, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      data.user_id,
      data.key_hash,
      data.key_prefix,
      data.name ?? "Default",
      data.permissions ?? [],
      data.expires_at ?? null,
    ],
  );

  if (!result) {
    throw new Error("Failed to create API key");
  }

  return result;
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(id: string): Promise<UserApiKey | null> {
  return queryOne<UserApiKey>("SELECT * FROM user_api_keys WHERE id = $1", [id]);
}

/**
 * Get API key by hash (for authentication)
 */
export async function getApiKeyByHash(keyHash: string): Promise<UserApiKey | null> {
  return queryOne<UserApiKey>(
    "SELECT * FROM user_api_keys WHERE key_hash = $1 AND is_active = true",
    [keyHash],
  );
}

/**
 * List API keys for a user
 */
export async function listApiKeysByUserId(userId: string): Promise<UserApiKey[]> {
  return queryAll<UserApiKey>(
    "SELECT * FROM user_api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
}

/**
 * List all API keys (admin)
 */
export async function listAllApiKeys(): Promise<UserApiKey[]> {
  return queryAll<UserApiKey>("SELECT * FROM user_api_keys ORDER BY created_at DESC");
}

/**
 * Update API key
 */
export async function updateApiKey(id: string, data: UserApiKeyUpdate): Promise<UserApiKey | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.permissions !== undefined) {
    fields.push(`permissions = $${paramIndex++}`);
    values.push(data.permissions);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.is_active);
  }
  if (data.last_used_at !== undefined) {
    fields.push(`last_used_at = $${paramIndex++}`);
    values.push(data.last_used_at);
  }
  if (data.expires_at !== undefined) {
    fields.push(`expires_at = $${paramIndex++}`);
    values.push(data.expires_at);
  }

  if (fields.length === 0) {
    return getApiKeyById(id);
  }

  values.push(id);

  return queryOne<UserApiKey>(
    `UPDATE user_api_keys SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}

/**
 * Delete API key
 */
export async function deleteApiKey(id: string): Promise<boolean> {
  const result = await query("DELETE FROM user_api_keys WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Revoke API key (soft delete)
 */
export async function revokeApiKey(id: string): Promise<UserApiKey | null> {
  return queryOne<UserApiKey>(
    `UPDATE user_api_keys
     SET is_active = false
     WHERE id = $1
     RETURNING *`,
    [id],
  );
}

/**
 * Update last used timestamp
 */
export async function updateLastUsed(id: string): Promise<void> {
  await query("UPDATE user_api_keys SET last_used_at = NOW() WHERE id = $1", [id]);
}

export default {
  createApiKey,
  getApiKeyById,
  getApiKeyByHash,
  listApiKeysByUserId,
  listAllApiKeys,
  updateApiKey,
  deleteApiKey,
  revokeApiKey,
  updateLastUsed,
};
