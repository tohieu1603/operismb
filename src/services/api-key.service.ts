/**
 * API Key Service - API key management
 */

import crypto from "node:crypto";
import { userApiKeysRepo, usersRepo } from "../db/index.js";
import { Errors } from "../core/errors/api-error.js";
import { sanitizeApiKey, sanitizeApiKeys } from "../utils/sanitize.util.js";
import type { SafeApiKey } from "../core/types/entities.js";

export interface ApiKeyWithUser extends SafeApiKey {
  user: { id: string; email: string; name: string } | null;
}

class ApiKeyService {
  async listByUser(userId: string): Promise<SafeApiKey[]> {
    const keys = await userApiKeysRepo.listApiKeysByUserId(userId);
    return sanitizeApiKeys(keys);
  }

  async listAll(): Promise<ApiKeyWithUser[]> {
    const keys = await userApiKeysRepo.listAllApiKeys();
    return Promise.all(
      keys.map(async (key) => {
        const user = await usersRepo.getUserById(key.user_id);
        return {
          ...sanitizeApiKey(key),
          user: user ? { id: user.id, email: user.email, name: user.name } : null,
        };
      }),
    );
  }

  async create(userId: string, name: string, permissions?: string[], expiresAt?: Date) {
    const rawKey = `sk_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const key = await userApiKeysRepo.createApiKey({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: rawKey.slice(0, 12),
      name,
      permissions: permissions || [],
      expires_at: expiresAt,
    });

    return { ...sanitizeApiKey(key), key: rawKey };
  }

  /** Allowed fields for API key update (whitelist to prevent mass assignment) */
  private static ALLOWED_UPDATE_FIELDS = new Set(["name", "permissions", "is_active", "expires_at"]);

  /** Update API key - scoped to user (anti-IDOR) */
  async updateByUser(id: string, userId: string, data: Record<string, unknown>): Promise<SafeApiKey> {
    const safeData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (ApiKeyService.ALLOWED_UPDATE_FIELDS.has(key)) {
        safeData[key] = value;
      }
    }
    const key = await userApiKeysRepo.updateApiKeyByUser(id, userId, safeData);
    if (!key) throw Errors.notFound("API key");
    return sanitizeApiKey(key);
  }

  /** Update API key - admin (no ownership check) */
  async update(id: string, data: Record<string, unknown>): Promise<SafeApiKey> {
    const safeData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (ApiKeyService.ALLOWED_UPDATE_FIELDS.has(key)) {
        safeData[key] = value;
      }
    }
    const key = await userApiKeysRepo.updateApiKey(id, safeData);
    if (!key) throw Errors.notFound("API key");
    return sanitizeApiKey(key);
  }

  /** Delete API key - scoped to user (anti-IDOR) */
  async deleteByUser(id: string, userId: string): Promise<void> {
    const deleted = await userApiKeysRepo.deleteApiKeyByUser(id, userId);
    if (!deleted) throw Errors.notFound("API key");
  }

  /** Delete API key - admin (no ownership check) */
  async delete(id: string): Promise<void> {
    const deleted = await userApiKeysRepo.deleteApiKey(id);
    if (!deleted) throw Errors.notFound("API key");
  }

  async validateKey(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const key = await userApiKeysRepo.getApiKeyByHash(keyHash);

    if (!key?.is_active) return null;
    if (key.expires_at && new Date(key.expires_at) < new Date()) return null;

    await userApiKeysRepo.updateLastUsed(key.id);
    return { userId: key.user_id, keyId: key.id };
  }
}

export const apiKeyService = new ApiKeyService();
