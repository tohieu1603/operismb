/**
 * Command Log Repository
 * CRUD operations for commands_log table
 */

import { AppDataSource } from "../data-source.js";
import { CommandLogEntity } from "../entities/command-log.entity.js";
import type { CommandLog, CommandLogCreate, CommandLogUpdate } from "./types.js";

// ============================================================================
// Repository Helper
// ============================================================================

function getRepo() {
  return AppDataSource.getRepository(CommandLogEntity);
}

// ============================================================================
// Command Log CRUD
// ============================================================================

/**
 * Create a new command log entry
 */
export async function createCommandLog(data: CommandLogCreate): Promise<CommandLog> {
  const commandLog = getRepo().create({
    box_id: data.box_id,
    agent_id: data.agent_id ?? null,
    command_id: data.command_id,
    command_type: data.command_type,
    command_payload: data.command_payload ?? null,
    metadata: data.metadata ?? {},
  });

  const result = await getRepo().save(commandLog);
  return result as unknown as CommandLog;
}

/**
 * Update command log with response
 */
export async function updateCommandLog(
  id: string,
  data: CommandLogUpdate,
): Promise<CommandLog | null> {
  const updateData: Record<string, any> = {};

  if (data.success !== undefined) updateData.success = data.success;
  if (data.response_payload !== undefined) updateData.response_payload = data.response_payload;
  if (data.error !== undefined) updateData.error = data.error;
  if (data.received_at !== undefined) updateData.received_at = data.received_at;
  if (data.duration_ms !== undefined) updateData.duration_ms = data.duration_ms;

  if (Object.keys(updateData).length === 0) {
    return getCommandLogById(id);
  }

  await getRepo().update({ id }, updateData);
  return getCommandLogById(id);
}

/**
 * Get command log by ID
 */
export async function getCommandLogById(id: string): Promise<CommandLog | null> {
  const result = await getRepo().findOneBy({ id });
  return result as unknown as CommandLog | null;
}

/**
 * Get command log by command_id (protocol ID)
 */
export async function getCommandLogByCommandId(commandId: string): Promise<CommandLog | null> {
  const result = await getRepo().findOneBy({ command_id: commandId });
  return result as unknown as CommandLog | null;
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

  const queryBuilder = getRepo()
    .createQueryBuilder("c")
    .where("c.box_id = :boxId", { boxId });

  if (options?.commandType) {
    queryBuilder.andWhere("c.command_type = :commandType", { commandType: options.commandType });
  }

  if (options?.since) {
    queryBuilder.andWhere("c.sent_at >= :since", { since: options.since });
  }

  const [commands, total] = await queryBuilder
    .orderBy("c.sent_at", "DESC")
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  return {
    commands: commands as unknown as CommandLog[],
    total,
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

  const commands = await getRepo().find({
    where: { agent_id: agentId },
    order: { sent_at: "DESC" },
    skip: offset,
    take: limit,
  });

  return commands as unknown as CommandLog[];
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

  const stats = await getRepo()
    .createQueryBuilder("c")
    .select("COUNT(*)", "total")
    .addSelect("COUNT(*) FILTER (WHERE c.success = true)", "success")
    .addSelect("COUNT(*) FILTER (WHERE c.success = false)", "failure")
    .addSelect("COALESCE(AVG(c.duration_ms) FILTER (WHERE c.duration_ms IS NOT NULL), 0)", "avg_duration")
    .where("c.box_id = :boxId", { boxId })
    .andWhere("c.sent_at >= :since", { since: sinceDate })
    .getRawOne();

  const byTypeResult = await getRepo()
    .createQueryBuilder("c")
    .select("c.command_type", "command_type")
    .addSelect("COUNT(*)", "count")
    .where("c.box_id = :boxId", { boxId })
    .andWhere("c.sent_at >= :since", { since: sinceDate })
    .groupBy("c.command_type")
    .getRawMany();

  const byType: Record<string, number> = {};
  for (const row of byTypeResult) {
    byType[row.command_type] = parseInt(row.count, 10);
  }

  return {
    total: parseInt(stats?.total ?? "0", 10),
    success: parseInt(stats?.success ?? "0", 10),
    failure: parseInt(stats?.failure ?? "0", 10),
    avgDurationMs: parseFloat(stats?.avg_duration ?? "0"),
    byType,
  };
}

/**
 * Delete old command logs
 * (for cleanup/retention policy)
 */
export async function deleteOldCommands(olderThanDays: number = 90): Promise<number> {
  const result = await getRepo()
    .createQueryBuilder()
    .delete()
    .from(CommandLogEntity)
    .where(`sent_at < NOW() - :days * INTERVAL '1 day'`, { days: olderThanDays })
    .execute();

  return result.affected ?? 0;
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
