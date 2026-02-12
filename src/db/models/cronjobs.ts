/**
 * Cronjob Repository
 * CRUD operations for cronjobs and cronjob_executions tables using TypeORM
 */

import { AppDataSource } from "../data-source.js";
import { CronjobEntity } from "../entities/cronjob.entity.js";
import { CronjobExecutionEntity } from "../entities/cronjob-execution.entity.js";
import type {
  Cronjob,
  CronjobCreate,
  CronjobUpdate,
  CronjobExecution,
  CronjobExecutionCreate,
} from "./types.js";

function getCronjobRepo() {
  return AppDataSource.getRepository(CronjobEntity);
}

function getExecutionRepo() {
  return AppDataSource.getRepository(CronjobExecutionEntity);
}

// ============================================================================
// Cronjob CRUD
// ============================================================================

/**
 * Create a new cronjob (Moltbot-compatible)
 */
export async function createCronjob(data: CronjobCreate): Promise<Cronjob> {
  const cronjob = getCronjobRepo().create({
    box_id: data.box_id ?? null,
    customer_id: data.customer_id,
    agent_id: data.agent_id ?? "main",
    name: data.name,
    description: data.description ?? null,
    schedule_type: data.schedule_type ?? "cron",
    schedule_expr: data.schedule_expr,
    schedule_tz: data.schedule_tz ?? null,
    schedule_interval_ms: data.schedule_interval_ms ?? null,
    schedule_at_ms: data.schedule_at_ms ?? null,
    schedule_anchor_ms: data.schedule_anchor_ms ?? null,
    session_target: data.session_target ?? "main",
    wake_mode: data.wake_mode ?? "next-heartbeat",
    payload_kind: data.payload_kind ?? "agentTurn",
    message: data.message,
    model: data.model ?? null,
    thinking: data.thinking ?? null,
    timeout_seconds: data.timeout_seconds ?? null,
    allow_unsafe_external_content: data.allow_unsafe_external_content ?? false,
    deliver: data.deliver ?? true,
    channel: data.channel ?? null,
    to_recipient: data.to_recipient ?? null,
    best_effort_deliver: data.best_effort_deliver ?? false,
    isolation_post_to_main_prefix: data.isolation_post_to_main_prefix ?? null,
    isolation_post_to_main_mode: data.isolation_post_to_main_mode ?? null,
    isolation_post_to_main_max_chars: data.isolation_post_to_main_max_chars ?? null,
    enabled: data.enabled ?? true,
    delete_after_run: data.delete_after_run ?? false,
    next_run_at: data.next_run_at ?? null,
    metadata: data.metadata ?? {},
  });

  const saved = await getCronjobRepo().save(cronjob);
  return saved as unknown as Cronjob;
}

/**
 * Get cronjob by ID
 */
export async function getCronjobById(id: string): Promise<Cronjob | null> {
  const result = await getCronjobRepo().findOneBy({ id });
  return result as unknown as Cronjob | null;
}

/**
 * Update cronjob (Moltbot-compatible)
 */
export async function updateCronjob(id: string, data: CronjobUpdate): Promise<Cronjob | null> {
  const updateData: Record<string, any> = {};

  // Basic fields
  if (data.agent_id !== undefined) updateData.agent_id = data.agent_id;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  // Schedule fields
  if (data.schedule_type !== undefined) updateData.schedule_type = data.schedule_type;
  if (data.schedule_expr !== undefined) updateData.schedule_expr = data.schedule_expr;
  if (data.schedule_tz !== undefined) updateData.schedule_tz = data.schedule_tz;
  if (data.schedule_interval_ms !== undefined) updateData.schedule_interval_ms = data.schedule_interval_ms;
  if (data.schedule_at_ms !== undefined) updateData.schedule_at_ms = data.schedule_at_ms;
  if (data.schedule_anchor_ms !== undefined) updateData.schedule_anchor_ms = data.schedule_anchor_ms;

  // Execution config
  if (data.session_target !== undefined) updateData.session_target = data.session_target;
  if (data.wake_mode !== undefined) updateData.wake_mode = data.wake_mode;

  // Payload fields
  if (data.payload_kind !== undefined) updateData.payload_kind = data.payload_kind;
  if (data.message !== undefined) updateData.message = data.message;
  if (data.model !== undefined) updateData.model = data.model;
  if (data.thinking !== undefined) updateData.thinking = data.thinking;
  if (data.timeout_seconds !== undefined) updateData.timeout_seconds = data.timeout_seconds;
  if (data.allow_unsafe_external_content !== undefined) updateData.allow_unsafe_external_content = data.allow_unsafe_external_content;
  if (data.deliver !== undefined) updateData.deliver = data.deliver;
  if (data.channel !== undefined) updateData.channel = data.channel;
  if (data.to_recipient !== undefined) updateData.to_recipient = data.to_recipient;
  if (data.best_effort_deliver !== undefined) updateData.best_effort_deliver = data.best_effort_deliver;

  // Isolation config
  if (data.isolation_post_to_main_prefix !== undefined) updateData.isolation_post_to_main_prefix = data.isolation_post_to_main_prefix;
  if (data.isolation_post_to_main_mode !== undefined) updateData.isolation_post_to_main_mode = data.isolation_post_to_main_mode;
  if (data.isolation_post_to_main_max_chars !== undefined) updateData.isolation_post_to_main_max_chars = data.isolation_post_to_main_max_chars;

  // State fields
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.delete_after_run !== undefined) updateData.delete_after_run = data.delete_after_run;
  if (data.running_at !== undefined) updateData.running_at = data.running_at;
  if (data.last_run_at !== undefined) updateData.last_run_at = data.last_run_at;
  if (data.last_status !== undefined) updateData.last_status = data.last_status;
  if (data.last_error !== undefined) updateData.last_error = data.last_error;
  if (data.last_duration_ms !== undefined) updateData.last_duration_ms = data.last_duration_ms;
  if (data.next_run_at !== undefined) updateData.next_run_at = data.next_run_at;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  if (Object.keys(updateData).length === 0) {
    return getCronjobById(id);
  }

  await getCronjobRepo().update({ id }, updateData);
  return getCronjobById(id);
}

/**
 * Get cronjob scoped to user (anti-IDOR: query with both id + customer_id)
 */
export async function getCronjobByIdAndUser(id: string, userId: string): Promise<Cronjob | null> {
  const result = await getCronjobRepo().findOneBy({ id, customer_id: userId });
  return result as unknown as Cronjob | null;
}

/**
 * Delete cronjob scoped to user (anti-IDOR)
 */
export async function deleteCronjobByUser(id: string, userId: string): Promise<boolean> {
  const result = await getCronjobRepo().delete({ id, customer_id: userId });
  return (result.affected ?? 0) > 0;
}

/**
 * Delete cronjob
 */
export async function deleteCronjob(id: string): Promise<boolean> {
  const result = await getCronjobRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * List cronjobs for a box
 */
export async function listCronjobsByBox(
  boxId: string,
  options?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<{ cronjobs: Cronjob[]; total: number }> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const qb = getCronjobRepo()
    .createQueryBuilder("c")
    .where("c.box_id = :boxId", { boxId });

  if (options?.enabled !== undefined) {
    qb.andWhere("c.enabled = :enabled", { enabled: options.enabled });
  }

  const [cronjobs, total] = await qb
    .orderBy("c.created_at", "DESC")
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  return {
    cronjobs: cronjobs as unknown as Cronjob[],
    total,
  };
}

/**
 * List cronjobs for a customer
 */
export async function listCronjobsByCustomer(
  customerId: string,
  options?: {
    boxId?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<{ cronjobs: Cronjob[]; total: number }> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const qb = getCronjobRepo()
    .createQueryBuilder("c")
    .where("c.customer_id = :customerId", { customerId });

  if (options?.boxId) {
    qb.andWhere("c.box_id = :boxId", { boxId: options.boxId });
  }
  if (options?.enabled !== undefined) {
    qb.andWhere("c.enabled = :enabled", { enabled: options.enabled });
  }

  const [cronjobs, total] = await qb
    .orderBy("c.created_at", "DESC")
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  return {
    cronjobs: cronjobs as unknown as Cronjob[],
    total,
  };
}

/**
 * Get cronjobs that are due to run
 */
export async function getDueCronjobs(limit: number = 100): Promise<Cronjob[]> {
  const cronjobs = await getCronjobRepo()
    .createQueryBuilder("c")
    .where("c.enabled = :enabled", { enabled: true })
    .andWhere("c.next_run_at <= NOW()")
    .orderBy("c.next_run_at", "ASC")
    .take(limit)
    .getMany();

  return cronjobs as unknown as Cronjob[];
}

/**
 * Toggle cronjob enabled status
 * When disabling, also clears next_run_at to prevent scheduling
 */
export async function toggleCronjob(id: string, enabled: boolean): Promise<Cronjob | null> {
  if (enabled) {
    // When enabling, just set enabled = true (next_run_at will be recalculated on next tick)
    await getCronjobRepo().update({ id }, { enabled });
  } else {
    // When disabling, also clear next_run_at to ensure job won't run
    await getCronjobRepo().update({ id }, { enabled, next_run_at: null });
  }
  return getCronjobById(id);
}

// ============================================================================
// Cronjob Execution CRUD
// ============================================================================

/**
 * Create a new execution record
 */
export async function createExecution(data: CronjobExecutionCreate): Promise<CronjobExecution> {
  const execution = getExecutionRepo().create({
    cronjob_id: data.cronjob_id,
    status: data.status ?? "running",
    started_at: data.started_at ?? new Date(),
    metadata: data.metadata ?? {},
  });

  const saved = await getExecutionRepo().save(execution);
  return saved as unknown as CronjobExecution;
}

/**
 * Complete an execution
 */
export async function completeExecution(
  id: string,
  data: {
    status: "success" | "failure";
    output?: string;
    error?: string;
  },
): Promise<CronjobExecution | null> {
  const finishedAt = new Date();

  // Get the execution to calculate duration
  const execution = await getExecutionRepo().findOneBy({ id });

  if (!execution) return null;

  const durationMs = Math.max(0, finishedAt.getTime() - new Date(execution.started_at).getTime());

  await getExecutionRepo().update(
    { id },
    {
      status: data.status,
      finished_at: finishedAt,
      duration_ms: durationMs,
      output: data.output ?? null,
      error: data.error ?? null,
    },
  );

  const updated = await getExecutionRepo().findOneBy({ id });
  return updated as unknown as CronjobExecution | null;
}

/**
 * Get execution by ID
 */
export async function getExecutionById(id: string): Promise<CronjobExecution | null> {
  const result = await getExecutionRepo().findOneBy({ id });
  return result as unknown as CronjobExecution | null;
}

/**
 * List executions for a cronjob
 */
export async function listExecutionsByCronjob(
  cronjobId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ executions: CronjobExecution[]; total: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const qb = getExecutionRepo()
    .createQueryBuilder("e")
    .where("e.cronjob_id = :cronjobId", { cronjobId });

  if (options?.status) {
    qb.andWhere("e.status = :status", { status: options.status });
  }

  const [executions, total] = await qb
    .orderBy("e.started_at", "DESC")
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  return {
    executions: executions as unknown as CronjobExecution[],
    total,
  };
}

/**
 * Run a cronjob (create execution, update last_run_at)
 * Returns the execution record
 */
export async function startCronjobRun(cronjobId: string): Promise<CronjobExecution> {
  return await AppDataSource.transaction(async (manager) => {
    // Update the cronjob's last_run_at
    await manager.update(CronjobEntity, { id: cronjobId }, { last_run_at: new Date() });

    // Create the execution record
    const execution = manager.create(CronjobExecutionEntity, {
      cronjob_id: cronjobId,
      status: "running",
      started_at: new Date(),
    });

    const saved = await manager.save(execution);
    return saved as unknown as CronjobExecution;
  });
}

/**
 * Delete old executions
 * (for cleanup/retention policy)
 */
export async function deleteOldExecutions(olderThanDays: number = 30): Promise<number> {
  const result = await AppDataSource.query(
    `DELETE FROM cronjob_executions
     WHERE started_at < NOW() - $1 * INTERVAL '1 day'
     RETURNING id`,
    [olderThanDays],
  );
  return result.length;
}

/**
 * List all cronjobs (admin) with user info
 */
export async function listAllCronjobs(options?: {
  userId?: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  cronjobs: (Cronjob & { user_email?: string; user_name?: string })[];
  total: number;
}> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const qb = getCronjobRepo()
    .createQueryBuilder("c")
    .leftJoinAndSelect("c.customer", "u");

  if (options?.userId) {
    qb.andWhere("c.customer_id = :userId", { userId: options.userId });
  }
  if (options?.enabled !== undefined) {
    qb.andWhere("c.enabled = :enabled", { enabled: options.enabled });
  }

  const [results, total] = await qb
    .orderBy("c.created_at", "DESC")
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  const cronjobs = results.map((c: any) => ({
    ...c,
    user_email: c.customer?.email,
    user_name: c.customer?.name,
  }));

  return {
    cronjobs: cronjobs as unknown as (Cronjob & { user_email?: string; user_name?: string })[],
    total,
  };
}

export default {
  // Cronjob
  createCronjob,
  getCronjobById,
  getCronjobByIdAndUser,
  updateCronjob,
  deleteCronjob,
  deleteCronjobByUser,
  listCronjobsByBox,
  listCronjobsByCustomer,
  listAllCronjobs,
  getDueCronjobs,
  toggleCronjob,
  // Execution
  createExecution,
  completeExecution,
  getExecutionById,
  listExecutionsByCronjob,
  startCronjobRun,
  deleteOldExecutions,
};
