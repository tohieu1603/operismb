/**
 * Box Repository
 * CRUD operations for boxes table (Mini-PC devices)
 */

import { query, queryOne, queryAll } from "../connection.js";
import type { Box, BoxCreate, BoxUpdate, BoxApiKey, BoxApiKeyCreate, BoxStatus } from "./types.js";

// ============================================================================
// Box CRUD
// ============================================================================

/**
 * Create a new box
 */
export async function createBox(data: BoxCreate): Promise<Box> {
  const result = await queryOne<Box>(
    `INSERT INTO boxes (
      customer_id, api_key_hash, name, hardware_id,
      hostname, os, arch, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.customer_id,
      data.api_key_hash,
      data.name,
      data.hardware_id ?? null,
      data.hostname ?? null,
      data.os ?? null,
      data.arch ?? null,
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  if (!result) {
    throw new Error("Failed to create box");
  }

  return result;
}

/**
 * Get box by ID
 */
export async function getBoxById(id: string): Promise<Box | null> {
  return queryOne<Box>("SELECT * FROM boxes WHERE id = $1", [id]);
}

/**
 * Get box by hardware ID
 */
export async function getBoxByHardwareId(hardwareId: string): Promise<Box | null> {
  return queryOne<Box>("SELECT * FROM boxes WHERE hardware_id = $1", [hardwareId]);
}

/**
 * Get box by API key hash
 */
export async function getBoxByApiKeyHash(apiKeyHash: string): Promise<Box | null> {
  return queryOne<Box>("SELECT * FROM boxes WHERE api_key_hash = $1", [apiKeyHash]);
}

/**
 * Update box
 */
export async function updateBox(id: string, data: BoxUpdate): Promise<Box | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.hostname !== undefined) {
    fields.push(`hostname = $${paramIndex++}`);
    values.push(data.hostname);
  }
  if (data.os !== undefined) {
    fields.push(`os = $${paramIndex++}`);
    values.push(data.os);
  }
  if (data.arch !== undefined) {
    fields.push(`arch = $${paramIndex++}`);
    values.push(data.arch);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.last_seen_at !== undefined) {
    fields.push(`last_seen_at = $${paramIndex++}`);
    values.push(data.last_seen_at);
  }
  if (data.last_ip !== undefined) {
    fields.push(`last_ip = $${paramIndex++}`);
    values.push(data.last_ip);
  }
  if (data.hardware_id !== undefined) {
    fields.push(`hardware_id = $${paramIndex++}`);
    values.push(data.hardware_id);
  }
  if (data.metadata !== undefined) {
    fields.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(data.metadata));
  }

  if (fields.length === 0) {
    return getBoxById(id);
  }

  values.push(id);

  return queryOne<Box>(
    `UPDATE boxes SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}

/**
 * Delete box
 */
export async function deleteBox(id: string): Promise<boolean> {
  const result = await query("DELETE FROM boxes WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * List boxes for a customer
 */
export async function listBoxesByCustomer(
  customerId: string,
  options?: {
    status?: BoxStatus;
    limit?: number;
    offset?: number;
  },
): Promise<{ boxes: Box[]; total: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const params: unknown[] = [customerId];

  let whereClause = "WHERE customer_id = $1";
  if (options?.status) {
    whereClause += ` AND status = $${params.length + 1}`;
    params.push(options.status);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM boxes ${whereClause}`,
    params,
  );

  const boxes = await queryAll<Box>(
    `SELECT * FROM boxes ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    boxes,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * Get online boxes for a customer
 */
export async function getOnlineBoxes(customerId: string): Promise<Box[]> {
  return queryAll<Box>(
    "SELECT * FROM boxes WHERE customer_id = $1 AND status = 'online' ORDER BY last_seen_at DESC",
    [customerId],
  );
}

/**
 * Update box status (used by relay gateway)
 */
export async function updateBoxStatus(
  id: string,
  status: BoxStatus,
  ip?: string,
): Promise<Box | null> {
  return queryOne<Box>(
    `UPDATE boxes SET
      status = $1,
      last_seen_at = NOW(),
      last_ip = COALESCE($2, last_ip)
     WHERE id = $3
     RETURNING *`,
    [status, ip ?? null, id],
  );
}

/**
 * Mark stale boxes as offline
 * (boxes not seen in the last X minutes)
 */
export async function markStaleBoxesOffline(staleMinutes: number = 5): Promise<number> {
  const result = await query(
    `UPDATE boxes SET status = 'offline'
     WHERE status = 'online'
       AND last_seen_at < NOW() - $1 * INTERVAL '1 minute'`,
    [staleMinutes],
  );
  return result.rowCount ?? 0;
}

// ============================================================================
// Box API Keys
// ============================================================================

/**
 * Create a new API key for a box
 */
export async function createApiKey(data: BoxApiKeyCreate): Promise<BoxApiKey> {
  const result = await queryOne<BoxApiKey>(
    `INSERT INTO box_api_keys (box_id, key_hash, key_prefix, name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.box_id, data.key_hash, data.key_prefix, data.name ?? "Default"],
  );

  if (!result) {
    throw new Error("Failed to create API key");
  }

  return result;
}

/**
 * Get API key by hash
 */
export async function getApiKeyByHash(keyHash: string): Promise<BoxApiKey | null> {
  return queryOne<BoxApiKey>(
    "SELECT * FROM box_api_keys WHERE key_hash = $1 AND is_active = true",
    [keyHash],
  );
}

/**
 * List API keys for a box
 */
export async function listApiKeysByBox(boxId: string): Promise<BoxApiKey[]> {
  return queryAll<BoxApiKey>(
    "SELECT * FROM box_api_keys WHERE box_id = $1 ORDER BY created_at DESC",
    [boxId],
  );
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await query(
    "UPDATE box_api_keys SET is_active = false, revoked_at = NOW() WHERE id = $1",
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Update API key last used timestamp
 */
export async function touchApiKey(id: string): Promise<void> {
  await query("UPDATE box_api_keys SET last_used_at = NOW() WHERE id = $1", [id]);
}

/**
 * Verify API key and get associated box
 * Returns box if key is valid and active
 */
export async function verifyApiKey(keyHash: string): Promise<{
  box: Box;
  apiKey: BoxApiKey;
} | null> {
  const result = await queryOne<Box & { api_key_id: string; api_key_name: string }>(
    `SELECT b.*, k.id as api_key_id, k.name as api_key_name
     FROM boxes b
     INNER JOIN box_api_keys k ON k.box_id = b.id
     WHERE k.key_hash = $1 AND k.is_active = true`,
    [keyHash],
  );

  if (!result) {
    return null;
  }

  // Touch the API key to update last_used_at
  await touchApiKey(result.api_key_id);

  const { api_key_id, api_key_name, ...boxData } = result;
  return {
    box: boxData as Box,
    apiKey: {
      id: api_key_id,
      box_id: boxData.id,
      key_hash: keyHash,
      key_prefix: "",
      name: api_key_name,
      is_active: true,
      last_used_at: new Date(),
      created_at: new Date(),
      revoked_at: null,
    },
  };
}

export default {
  // Box CRUD
  createBox,
  getBoxById,
  getBoxByHardwareId,
  getBoxByApiKeyHash,
  updateBox,
  deleteBox,
  listBoxesByCustomer,
  getOnlineBoxes,
  updateBoxStatus,
  markStaleBoxesOffline,
  // API Keys
  createApiKey,
  getApiKeyByHash,
  listApiKeysByBox,
  revokeApiKey,
  touchApiKey,
  verifyApiKey,
};
