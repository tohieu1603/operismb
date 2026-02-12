/**
 * User API Key Repository
 * CRUD operations for user_api_keys table (TypeORM)
 */

import { AppDataSource } from "../data-source.js";
import { UserApiKeyEntity } from "../entities/user-api-key.entity.js";
import type { UserApiKey, UserApiKeyCreate, UserApiKeyUpdate } from "./types.js";

function getRepo() {
  return AppDataSource.getRepository(UserApiKeyEntity);
}

/**
 * Create a new API key
 */
export async function createApiKey(data: UserApiKeyCreate): Promise<UserApiKey> {
  const entity = getRepo().create({
    user_id: data.user_id,
    key_hash: data.key_hash,
    key_prefix: data.key_prefix,
    name: data.name ?? "Default",
    permissions: data.permissions ?? [],
    expires_at: data.expires_at ?? null,
  });
  const saved = await getRepo().save(entity);
  return saved as unknown as UserApiKey;
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(id: string): Promise<UserApiKey | null> {
  const result = await getRepo().findOneBy({ id });
  return (result as unknown as UserApiKey) ?? null;
}

/**
 * Get API key by hash (for authentication)
 */
export async function getApiKeyByHash(keyHash: string): Promise<UserApiKey | null> {
  const result = await getRepo().findOneBy({ key_hash: keyHash, is_active: true });
  return (result as unknown as UserApiKey) ?? null;
}

/**
 * List API keys for a user
 */
export async function listApiKeysByUserId(userId: string): Promise<UserApiKey[]> {
  const results = await getRepo().find({
    where: { user_id: userId },
    order: { created_at: "DESC" },
  });
  return results as unknown as UserApiKey[];
}

/**
 * List all API keys (admin)
 */
export async function listAllApiKeys(): Promise<UserApiKey[]> {
  const results = await getRepo().find({ order: { created_at: "DESC" } });
  return results as unknown as UserApiKey[];
}

/**
 * Update API key
 */
export async function updateApiKey(id: string, data: UserApiKeyUpdate): Promise<UserApiKey | null> {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.permissions !== undefined) updateData.permissions = data.permissions;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;
  if (data.last_used_at !== undefined) updateData.last_used_at = data.last_used_at;
  if (data.expires_at !== undefined) updateData.expires_at = data.expires_at;

  if (Object.keys(updateData).length === 0) {
    return getApiKeyById(id);
  }

  await getRepo().update({ id }, updateData);
  return getApiKeyById(id);
}

/**
 * Get API key scoped to user (anti-IDOR: query with both id + user_id)
 */
export async function getApiKeyByIdAndUser(id: string, userId: string): Promise<UserApiKey | null> {
  const result = await getRepo().findOneBy({ id, user_id: userId });
  return (result as unknown as UserApiKey) ?? null;
}

/**
 * Update API key scoped to user (anti-IDOR)
 */
export async function updateApiKeyByUser(id: string, userId: string, data: UserApiKeyUpdate): Promise<UserApiKey | null> {
  const existing = await getRepo().findOneBy({ id, user_id: userId });
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.permissions !== undefined) updateData.permissions = data.permissions;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;
  if (data.last_used_at !== undefined) updateData.last_used_at = data.last_used_at;
  if (data.expires_at !== undefined) updateData.expires_at = data.expires_at;

  if (Object.keys(updateData).length === 0) {
    return existing as unknown as UserApiKey;
  }

  await getRepo().update({ id, user_id: userId }, updateData);
  return getApiKeyByIdAndUser(id, userId);
}

/**
 * Delete API key scoped to user (anti-IDOR)
 */
export async function deleteApiKeyByUser(id: string, userId: string): Promise<boolean> {
  const result = await getRepo().delete({ id, user_id: userId });
  return (result.affected ?? 0) > 0;
}

/**
 * Delete API key
 */
export async function deleteApiKey(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Revoke API key (soft delete)
 */
export async function revokeApiKey(id: string): Promise<UserApiKey | null> {
  await getRepo().update({ id }, { is_active: false });
  return getApiKeyById(id);
}

/**
 * Update last used timestamp
 */
export async function updateLastUsed(id: string): Promise<void> {
  await getRepo().update({ id }, { last_used_at: new Date() });
}

export default {
  createApiKey,
  getApiKeyById,
  getApiKeyByIdAndUser,
  getApiKeyByHash,
  listApiKeysByUserId,
  listAllApiKeys,
  updateApiKey,
  updateApiKeyByUser,
  deleteApiKey,
  deleteApiKeyByUser,
  revokeApiKey,
  updateLastUsed,
};
