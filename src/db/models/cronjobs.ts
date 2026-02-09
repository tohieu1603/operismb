/**
 * Cronjob Repository
 * CRUD operations for cronjobs and cronjob_executions tables
 */

import { queryOne, queryAll, transaction } from "../connection.js";
import type {
  Cronjob,
  CronjobCreate,
  CronjobUpdate,
  CronjobExecution,
  CronjobExecutionCreate,
} from "./types.js";

// ============================================================================
// Cronjob CRUD
// ============================================================================

/**
 * Create a new cronjob (Moltbot-compatible)
 */
export async function createCronjob(data: CronjobCreate): Promise<Cronjob> {
  const result = await queryOne<Cronjob>(
    `INSERT INTO cronjobs (
      box_id, customer_id, agent_id, name, description,
      schedule_type, schedule_expr, schedule_tz, schedule_interval_ms, schedule_at_ms, schedule_anchor_ms,
      session_target, wake_mode,
      payload_kind, message, model, thinking, timeout_seconds, allow_unsafe_external_content,
      deliver, channel, to_recipient, best_effort_deliver,
      isolation_post_to_main_prefix, isolation_post_to_main_mode, isolation_post_to_main_max_chars,
      enabled, delete_after_run, next_run_at, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
    RETURNING *`,
    [
      data.box_id ?? null,
      data.customer_id,
      data.agent_id ?? "main",
      data.name,
      data.description ?? null,
      data.schedule_type ?? "cron",
      data.schedule_expr,
      data.schedule_tz ?? null,
      data.schedule_interval_ms ?? null,
      data.schedule_at_ms ?? null,
      data.schedule_anchor_ms ?? null,
      data.session_target ?? "main",
      data.wake_mode ?? "next-heartbeat",
      data.payload_kind ?? "agentTurn",
      data.message,
      data.model ?? null,
      data.thinking ?? null,
      data.timeout_seconds ?? null,
      data.allow_unsafe_external_content ?? false,
      data.deliver ?? true,
      data.channel ?? null,
      data.to_recipient ?? null,
      data.best_effort_deliver ?? false,
      data.isolation_post_to_main_prefix ?? null,
      data.isolation_post_to_main_mode ?? null,
      data.isolation_post_to_main_max_chars ?? null,
      data.enabled ?? true,
      data.delete_after_run ?? false,
      data.next_run_at ?? null,
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  if (!result) {
    throw new Error("Failed to create cronjob");
  }

  return result;
}

/**
 * Get cronjob by ID
 */
export async function getCronjobById(id: string): Promise<Cronjob | null> {
  return queryOne<Cronjob>("SELECT * FROM cronjobs WHERE id = $1", [id]);
}

/**
 * Update cronjob (Moltbot-compatible)
 */
export async function updateCronjob(id: string, data: CronjobUpdate): Promise<Cronjob | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Basic fields
  if (data.agent_id !== undefined) {
    fields.push(`agent_id = $${paramIndex++}`);
    values.push(data.agent_id);
  }
  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }

  // Schedule fields
  if (data.schedule_type !== undefined) {
    fields.push(`schedule_type = $${paramIndex++}`);
    values.push(data.schedule_type);
  }
  if (data.schedule_expr !== undefined) {
    fields.push(`schedule_expr = $${paramIndex++}`);
    values.push(data.schedule_expr);
  }
  if (data.schedule_tz !== undefined) {
    fields.push(`schedule_tz = $${paramIndex++}`);
    values.push(data.schedule_tz);
  }
  if (data.schedule_interval_ms !== undefined) {
    fields.push(`schedule_interval_ms = $${paramIndex++}`);
    values.push(data.schedule_interval_ms);
  }
  if (data.schedule_at_ms !== undefined) {
    fields.push(`schedule_at_ms = $${paramIndex++}`);
    values.push(data.schedule_at_ms);
  }
  if (data.schedule_anchor_ms !== undefined) {
    fields.push(`schedule_anchor_ms = $${paramIndex++}`);
    values.push(data.schedule_anchor_ms);
  }

  // Execution config
  if (data.session_target !== undefined) {
    fields.push(`session_target = $${paramIndex++}`);
    values.push(data.session_target);
  }
  if (data.wake_mode !== undefined) {
    fields.push(`wake_mode = $${paramIndex++}`);
    values.push(data.wake_mode);
  }

  // Payload fields
  if (data.payload_kind !== undefined) {
    fields.push(`payload_kind = $${paramIndex++}`);
    values.push(data.payload_kind);
  }
  if (data.message !== undefined) {
    fields.push(`message = $${paramIndex++}`);
    values.push(data.message);
  }
  if (data.model !== undefined) {
    fields.push(`model = $${paramIndex++}`);
    values.push(data.model);
  }
  if (data.thinking !== undefined) {
    fields.push(`thinking = $${paramIndex++}`);
    values.push(data.thinking);
  }
  if (data.timeout_seconds !== undefined) {
    fields.push(`timeout_seconds = $${paramIndex++}`);
    values.push(data.timeout_seconds);
  }
  if (data.allow_unsafe_external_content !== undefined) {
    fields.push(`allow_unsafe_external_content = $${paramIndex++}`);
    values.push(data.allow_unsafe_external_content);
  }
  if (data.deliver !== undefined) {
    fields.push(`deliver = $${paramIndex++}`);
    values.push(data.deliver);
  }
  if (data.channel !== undefined) {
    fields.push(`channel = $${paramIndex++}`);
    values.push(data.channel);
  }
  if (data.to_recipient !== undefined) {
    fields.push(`to_recipient = $${paramIndex++}`);
    values.push(data.to_recipient);
  }
  if (data.best_effort_deliver !== undefined) {
    fields.push(`best_effort_deliver = $${paramIndex++}`);
    values.push(data.best_effort_deliver);
  }

  // Isolation config
  if (data.isolation_post_to_main_prefix !== undefined) {
    fields.push(`isolation_post_to_main_prefix = $${paramIndex++}`);
    values.push(data.isolation_post_to_main_prefix);
  }
  if (data.isolation_post_to_main_mode !== undefined) {
    fields.push(`isolation_post_to_main_mode = $${paramIndex++}`);
    values.push(data.isolation_post_to_main_mode);
  }
  if (data.isolation_post_to_main_max_chars !== undefined) {
    fields.push(`isolation_post_to_main_max_chars = $${paramIndex++}`);
    values.push(data.isolation_post_to_main_max_chars);
  }

  // State fields
  if (data.enabled !== undefined) {
    fields.push(`enabled = $${paramIndex++}`);
    values.push(data.enabled);
  }
  if (data.delete_after_run !== undefined) {
    fields.push(`delete_after_run = $${paramIndex++}`);
    values.push(data.delete_after_run);
  }
  if (data.running_at !== undefined) {
    fields.push(`running_at = $${paramIndex++}`);
    values.push(data.running_at);
  }
  if (data.last_run_at !== undefined) {
    fields.push(`last_run_at = $${paramIndex++}`);
    values.push(data.last_run_at);
  }
  if (data.last_status !== undefined) {
    fields.push(`last_status = $${paramIndex++}`);
    values.push(data.last_status);
  }
  if (data.last_error !== undefined) {
    fields.push(`last_error = $${paramIndex++}`);
    values.push(data.last_error);
  }
  if (data.last_duration_ms !== undefined) {
    fields.push(`last_duration_ms = $${paramIndex++}`);
    values.push(data.last_duration_ms);
  }
  if (data.next_run_at !== undefined) {
    fields.push(`next_run_at = $${paramIndex++}`);
    values.push(data.next_run_at);
  }
  if (data.metadata !== undefined) {
    fields.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(data.metadata));
  }

  if (fields.length === 0) {
    return getCronjobById(id);
  }

  values.push(id);

  return queryOne<Cronjob>(
    `UPDATE cronjobs SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}

/**
 * Delete cronjob
 */
export async function deleteCronjob(id: string): Promise<boolean> {
  const result = await queryOne<{ id: string }>("DELETE FROM cronjobs WHERE id = $1 RETURNING id", [
    id,
  ]);
  return result !== null;
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
  const params: unknown[] = [boxId];

  let whereClause = "WHERE box_id = $1";

  if (options?.enabled !== undefined) {
    whereClause += ` AND enabled = $${params.length + 1}`;
    params.push(options.enabled);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM cronjobs ${whereClause}`,
    params,
  );

  const cronjobs = await queryAll<Cronjob>(
    `SELECT * FROM cronjobs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    cronjobs,
    total: parseInt(countResult?.count ?? "0", 10),
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
  const params: unknown[] = [customerId];

  let whereClause = "WHERE customer_id = $1";

  if (options?.boxId) {
    whereClause += ` AND box_id = $${params.length + 1}`;
    params.push(options.boxId);
  }
  if (options?.enabled !== undefined) {
    whereClause += ` AND enabled = $${params.length + 1}`;
    params.push(options.enabled);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM cronjobs ${whereClause}`,
    params,
  );

  const cronjobs = await queryAll<Cronjob>(
    `SELECT * FROM cronjobs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    cronjobs,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * Get cronjobs that are due to run
 */
export async function getDueCronjobs(limit: number = 100): Promise<Cronjob[]> {
  return queryAll<Cronjob>(
    `SELECT * FROM cronjobs
     WHERE enabled = true AND next_run_at <= NOW()
     ORDER BY next_run_at ASC
     LIMIT $1`,
    [limit],
  );
}

/**
 * Toggle cronjob enabled status
 * When disabling, also clears next_run_at to prevent scheduling
 */
export async function toggleCronjob(id: string, enabled: boolean): Promise<Cronjob | null> {
  if (enabled) {
    // When enabling, just set enabled = true (next_run_at will be recalculated on next tick)
    return queryOne<Cronjob>("UPDATE cronjobs SET enabled = $1 WHERE id = $2 RETURNING *", [
      enabled,
      id,
    ]);
  } else {
    // When disabling, also clear next_run_at to ensure job won't run
    return queryOne<Cronjob>(
      "UPDATE cronjobs SET enabled = $1, next_run_at = NULL WHERE id = $2 RETURNING *",
      [enabled, id],
    );
  }
}

// ============================================================================
// Cronjob Execution CRUD
// ============================================================================

/**
 * Create a new execution record
 */
export async function createExecution(data: CronjobExecutionCreate): Promise<CronjobExecution> {
  const result = await queryOne<CronjobExecution>(
    `INSERT INTO cronjob_executions (
      cronjob_id, status, started_at, metadata
    ) VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [
      data.cronjob_id,
      data.status ?? "running",
      data.started_at ?? new Date(),
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  if (!result) {
    throw new Error("Failed to create cronjob execution");
  }

  return result;
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
  const execution = await queryOne<CronjobExecution>(
    "SELECT * FROM cronjob_executions WHERE id = $1",
    [id],
  );

  if (!execution) return null;

  const durationMs = Math.max(0, finishedAt.getTime() - new Date(execution.started_at).getTime());

  return queryOne<CronjobExecution>(
    `UPDATE cronjob_executions SET
      status = $1,
      finished_at = $2,
      duration_ms = $3,
      output = $4,
      error = $5
     WHERE id = $6
     RETURNING *`,
    [data.status, finishedAt, durationMs, data.output ?? null, data.error ?? null, id],
  );
}

/**
 * Get execution by ID
 */
export async function getExecutionById(id: string): Promise<CronjobExecution | null> {
  return queryOne<CronjobExecution>("SELECT * FROM cronjob_executions WHERE id = $1", [id]);
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
  const params: unknown[] = [cronjobId];

  let whereClause = "WHERE cronjob_id = $1";

  if (options?.status) {
    whereClause += ` AND status = $${params.length + 1}`;
    params.push(options.status);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM cronjob_executions ${whereClause}`,
    params,
  );

  const executions = await queryAll<CronjobExecution>(
    `SELECT * FROM cronjob_executions ${whereClause}
     ORDER BY started_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    executions,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * Run a cronjob (create execution, update last_run_at)
 * Returns the execution record
 */
export async function startCronjobRun(cronjobId: string): Promise<CronjobExecution> {
  return await transaction(async (client) => {
    // Update the cronjob's last_run_at
    await client.query("UPDATE cronjobs SET last_run_at = NOW() WHERE id = $1", [cronjobId]);

    // Create the execution record
    const result = await client.query<CronjobExecution>(
      `INSERT INTO cronjob_executions (cronjob_id, status, started_at)
       VALUES ($1, 'running', NOW())
       RETURNING *`,
      [cronjobId],
    );

    if (!result.rows[0]) {
      throw new Error("Failed to create cronjob execution");
    }

    return result.rows[0];
  });
}

/**
 * Delete old executions
 * (for cleanup/retention policy)
 */
export async function deleteOldExecutions(olderThanDays: number = 30): Promise<number> {
  const result = await queryAll<{ id: string }>(
    `DELETE FROM cronjob_executions
     WHERE started_at < NOW() - INTERVAL '${olderThanDays} days'
     RETURNING id`,
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
  const params: unknown[] = [];

  let whereClause = "WHERE 1=1";

  if (options?.userId) {
    params.push(options.userId);
    whereClause += ` AND c.customer_id = $${params.length}`;
  }
  if (options?.enabled !== undefined) {
    params.push(options.enabled);
    whereClause += ` AND c.enabled = $${params.length}`;
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM cronjobs c ${whereClause}`,
    params,
  );

  const cronjobs = await queryAll<Cronjob & { user_email?: string; user_name?: string }>(
    `SELECT c.*, u.email as user_email, u.name as user_name
     FROM cronjobs c
     LEFT JOIN users u ON c.customer_id = u.id
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    cronjobs,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

export default {
  // Cronjob
  createCronjob,
  getCronjobById,
  updateCronjob,
  deleteCronjob,
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
