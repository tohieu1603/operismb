/**
 * Box Repository
 * CRUD operations for boxes table (Mini-PC devices)
 */

import { AppDataSource } from "../data-source";
import { BoxEntity } from "../entities/box.entity";
import { BoxApiKeyEntity } from "../entities/box-api-key.entity";
import type { Box, BoxCreate, BoxUpdate, BoxApiKey, BoxApiKeyCreate, BoxStatus } from "./types";

// ============================================================================
// Repository Helpers
// ============================================================================

function getBoxRepo() {
  return AppDataSource.getRepository(BoxEntity);
}

function getApiKeyRepo() {
  return AppDataSource.getRepository(BoxApiKeyEntity);
}

// ============================================================================
// Box CRUD
// ============================================================================

/**
 * Create a new box
 */
export async function createBox(data: BoxCreate): Promise<Box> {
  const box = getBoxRepo().create({
    customer_id: data.customer_id,
    api_key_hash: data.api_key_hash,
    name: data.name,
    hardware_id: data.hardware_id ?? null,
    hostname: data.hostname ?? null,
    os: data.os ?? null,
    arch: data.arch ?? null,
    metadata: data.metadata ?? {},
  });

  const result = await getBoxRepo().save(box);
  return result as unknown as Box;
}

/**
 * Get box by ID
 */
export async function getBoxById(id: string): Promise<Box | null> {
  const result = await getBoxRepo().findOneBy({ id });
  return result as unknown as Box | null;
}

/**
 * Get box by hardware ID
 */
export async function getBoxByHardwareId(hardwareId: string): Promise<Box | null> {
  const result = await getBoxRepo().findOneBy({ hardware_id: hardwareId });
  return result as unknown as Box | null;
}

/**
 * Get box by API key hash
 */
export async function getBoxByApiKeyHash(apiKeyHash: string): Promise<Box | null> {
  const result = await getBoxRepo().findOneBy({ api_key_hash: apiKeyHash });
  return result as unknown as Box | null;
}

/**
 * Update box
 */
export async function updateBox(id: string, data: BoxUpdate): Promise<Box | null> {
  const updateData: Record<string, any> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.hostname !== undefined) updateData.hostname = data.hostname;
  if (data.os !== undefined) updateData.os = data.os;
  if (data.arch !== undefined) updateData.arch = data.arch;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.last_seen_at !== undefined) updateData.last_seen_at = data.last_seen_at;
  if (data.last_ip !== undefined) updateData.last_ip = data.last_ip;
  if (data.hardware_id !== undefined) updateData.hardware_id = data.hardware_id;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  if (Object.keys(updateData).length === 0) {
    return getBoxById(id);
  }

  await getBoxRepo().update({ id }, updateData);
  return getBoxById(id);
}

/**
 * Delete box
 */
export async function deleteBox(id: string): Promise<boolean> {
  const result = await getBoxRepo().delete({ id });
  return (result.affected ?? 0) > 0;
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

  const queryBuilder = getBoxRepo()
    .createQueryBuilder("b")
    .where("b.customer_id = :customerId", { customerId });

  if (options?.status) {
    queryBuilder.andWhere("b.status = :status", { status: options.status });
  }

  const [boxes, total] = await queryBuilder
    .orderBy("b.created_at", "DESC")
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  return {
    boxes: boxes as unknown as Box[],
    total,
  };
}

/**
 * Get online boxes for a customer
 */
export async function getOnlineBoxes(customerId: string): Promise<Box[]> {
  const boxes = await getBoxRepo().find({
    where: {
      customer_id: customerId,
      status: "online",
    },
    order: {
      last_seen_at: "DESC",
    },
  });

  return boxes as unknown as Box[];
}

/**
 * Update box status (used by relay gateway)
 */
export async function updateBoxStatus(
  id: string,
  status: BoxStatus,
  ip?: string,
): Promise<Box | null> {
  await getBoxRepo()
    .createQueryBuilder()
    .update(BoxEntity)
    .set({
      status,
      last_seen_at: () => "NOW()",
      ...(ip ? { last_ip: ip } : {}),
    })
    .where("id = :id", { id })
    .execute();

  return getBoxById(id);
}

/**
 * Mark stale boxes as offline
 * (boxes not seen in the last X minutes)
 */
export async function markStaleBoxesOffline(staleMinutes: number = 5): Promise<number> {
  const result = await getBoxRepo()
    .createQueryBuilder()
    .update(BoxEntity)
    .set({ status: "offline" })
    .where("status = :status", { status: "online" })
    .andWhere(`last_seen_at < NOW() - :minutes * INTERVAL '1 minute'`, { minutes: staleMinutes })
    .execute();

  return result.affected ?? 0;
}

// ============================================================================
// Box API Keys
// ============================================================================

/**
 * Create a new API key for a box
 */
export async function createApiKey(data: BoxApiKeyCreate): Promise<BoxApiKey> {
  const apiKey = getApiKeyRepo().create({
    box_id: data.box_id,
    key_hash: data.key_hash,
    key_prefix: data.key_prefix,
    name: data.name ?? "Default",
  });

  const result = await getApiKeyRepo().save(apiKey);
  return result as unknown as BoxApiKey;
}

/**
 * Get API key by hash
 */
export async function getApiKeyByHash(keyHash: string): Promise<BoxApiKey | null> {
  const result = await getApiKeyRepo().findOne({
    where: {
      key_hash: keyHash,
      is_active: true,
    },
  });

  return result as unknown as BoxApiKey | null;
}

/**
 * List API keys for a box
 */
export async function listApiKeysByBox(boxId: string): Promise<BoxApiKey[]> {
  const keys = await getApiKeyRepo().find({
    where: { box_id: boxId },
    order: { created_at: "DESC" },
  });

  return keys as unknown as BoxApiKey[];
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await getApiKeyRepo()
    .createQueryBuilder()
    .update(BoxApiKeyEntity)
    .set({
      is_active: false,
      revoked_at: () => "NOW()",
    })
    .where("id = :id", { id })
    .execute();

  return (result.affected ?? 0) > 0;
}

/**
 * Update API key last used timestamp
 */
export async function touchApiKey(id: string): Promise<void> {
  await getApiKeyRepo()
    .createQueryBuilder()
    .update(BoxApiKeyEntity)
    .set({ last_used_at: () => "NOW()" })
    .where("id = :id", { id })
    .execute();
}

/**
 * Verify API key and get associated box
 * Returns box if key is valid and active
 */
export async function verifyApiKey(keyHash: string): Promise<{
  box: Box;
  apiKey: BoxApiKey;
} | null> {
  const result = await getApiKeyRepo()
    .createQueryBuilder("k")
    .innerJoinAndSelect("k.box", "b")
    .where("k.key_hash = :keyHash AND k.is_active = true", { keyHash })
    .getOne();

  if (!result) {
    return null;
  }

  // Touch the API key to update last_used_at
  await touchApiKey(result.id);

  return {
    box: result.box as unknown as Box,
    apiKey: {
      id: result.id,
      box_id: result.box_id,
      key_hash: result.key_hash,
      key_prefix: result.key_prefix,
      name: result.name,
      is_active: result.is_active,
      last_used_at: new Date(),
      created_at: result.created_at,
      revoked_at: result.revoked_at,
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
