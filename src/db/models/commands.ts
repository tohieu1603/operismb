/**
 * Command Log Repository
 * CRUD operations for commands_log table
 */

import { query, queryOne, queryAll } from "../connection.js";
import type { CommandLog, CommandLogCreate, CommandLogUpdate } from "./types.js";

/**
 * Create a new command log entry
 */
export async function createCommandLog(data: CommandLogCreate): Promise<CommandLog> {
  const result = await queryOne<CommandLog>(
    `INSERT INTO commands_log (
      box_id, agent_id, command_id, command_type,
      command_payload, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      data.box_id,
      data.agent_id ?? null,
      data.command_id,
      data.command_type,
      data.command_payload ? JSON.stringify(data.command_payload) : null,
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  if (!result) {
    throw new Error("Failed to create command log");
  }

  return result;
}

/**
 * Update command log with response
 */
export async function updateCommandLog(
  id: string,
  data: CommandLogUpdate,
): Promise<CommandLog | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.success !== undefined) {
    fields.push(`success = $${paramIndex++}`);
    values.push(data.success);
  }
  if (data.response_payload !== undefined) {
    fields.push(`response_payload = $${paramIndex++}`);
    values.push(JSON.stringify(data.response_payload));
  }
  if (data.error !== undefined) {
    fields.push(`error = $${paramIndex++}`);
    values.push(data.error);
  }
  if (data.received_at !== undefined) {
    fields.push(`received_at = $${paramIndex++}`);
    values.push(data.received_at);
  }
  if (data.duration_ms !== undefined) {
    fields.push(`duration_ms = $${paramIndex++}`);
    values.push(data.duration_ms);
  }

  if (fields.length === 0) {
    return queryOne<CommandLog>("SELECT * FROM commands_log WHERE id = $1", [id]);
  }

  values.push(id);

  return queryOne<CommandLog>(
    `UPDATE commands_log SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}

/**
 * Get command log by ID
 */
export async function getCommandLogById(id: string): Promise<CommandLog | null> {
  return queryOne<CommandLog>("SELECT * FROM commands_log WHERE id = $1", [id]);
}

/**
 * Get command log by command_id (protocol ID)
 */
export async function getCommandLogByCommandId(commandId: string): Promise<CommandLog | null> {
  return queryOne<CommandLog>("SELECT * FROM commands_log WHERE command_id = $1", [commandId]);
}

/**
 * List recent commands for a box
 */
export async function listCommandsByBox(
  boxId: string,
  options?: {
    limit?: number;
    offset?: number;
    commandType?: string;
    since?: Date;
  },
): Promise<{ commands: CommandLog[]; total: number }> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const params: unknown[] = [boxId];

  let whereClause = "WHERE box_id = $1";

  if (options?.commandType) {
    whereClause += ` AND command_type = $${params.length + 1}`;
    params.push(options.commandType);
  }

  if (options?.since) {
    whereClause += ` AND sent_at >= $${params.length + 1}`;
    params.push(options.since);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM commands_log ${whereClause}`,
    params,
  );

  const commands = await queryAll<CommandLog>(
    `SELECT * FROM commands_log ${whereClause}
     ORDER BY sent_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    commands,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * List recent commands for an agent
 */
export async function listCommandsByAgent(
  agentId: string,
  options?: {
    limit?: number;
    offset?: number;
  },
): Promise<CommandLog[]> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  return queryAll<CommandLog>(
    `SELECT * FROM commands_log
     WHERE agent_id = $1
     ORDER BY sent_at DESC
     LIMIT $2 OFFSET $3`,
    [agentId, limit, offset],
  );
}

/**
 * Get command statistics for a box
 */
export async function getCommandStats(
  boxId: string,
  since?: Date,
): Promise<{
  total: number;
  success: number;
  failure: number;
  avgDurationMs: number;
  byType: Record<string, number>;
}> {
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

  const statsResult = await queryOne<{
    total: string;
    success: string;
    failure: string;
    avg_duration: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE success = true) as success,
      COUNT(*) FILTER (WHERE success = false) as failure,
      COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL), 0) as avg_duration
     FROM commands_log
     WHERE box_id = $1 AND sent_at >= $2`,
    [boxId, sinceDate],
  );

  const byTypeResult = await queryAll<{ command_type: string; count: string }>(
    `SELECT command_type, COUNT(*) as count
     FROM commands_log
     WHERE box_id = $1 AND sent_at >= $2
     GROUP BY command_type`,
    [boxId, sinceDate],
  );

  const byType: Record<string, number> = {};
  for (const row of byTypeResult) {
    byType[row.command_type] = parseInt(row.count, 10);
  }

  return {
    total: parseInt(statsResult?.total ?? "0", 10),
    success: parseInt(statsResult?.success ?? "0", 10),
    failure: parseInt(statsResult?.failure ?? "0", 10),
    avgDurationMs: parseFloat(statsResult?.avg_duration ?? "0"),
    byType,
  };
}

/**
 * Delete old command logs
 * (for cleanup/retention policy)
 */
export async function deleteOldCommands(olderThanDays: number = 90): Promise<number> {
  const result = await query(
    `DELETE FROM commands_log
     WHERE sent_at < NOW() - $1 * INTERVAL '1 day'`,
    [olderThanDays],
  );
  return result.rowCount ?? 0;
}

export default {
  createCommandLog,
  updateCommandLog,
  getCommandLogById,
  getCommandLogByCommandId,
  listCommandsByBox,
  listCommandsByAgent,
  getCommandStats,
  deleteOldCommands,
};
