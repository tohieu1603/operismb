/**
 * Activity Logs Repository
 * CRUD operations for activity_logs table
 */

import { AppDataSource } from "../data-source";
import {
  ActivityLogEntity,
  ActivityAction,
  ActivityEntityType,
} from "../entities/activity-log.entity";

function getRepo() {
  return AppDataSource.getRepository(ActivityLogEntity);
}

export interface ActivityLogListOptions {
  page?: number;
  limit?: number;
  userId?: string;
  action?: ActivityAction;
  entityType?: ActivityEntityType;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * List activity logs with pagination
 */
export async function listActivityLogs(
  options: ActivityLogListOptions = {}
): Promise<{ data: ActivityLogEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 200);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const qb = getRepo().createQueryBuilder("l");

  if (options.userId) {
    qb.andWhere("l.user_id = :userId", { userId: options.userId });
  }

  if (options.action) {
    qb.andWhere("l.action = :action", { action: options.action });
  }

  if (options.entityType) {
    qb.andWhere("l.entity_type = :entityType", { entityType: options.entityType });
  }

  if (options.entityId) {
    qb.andWhere("l.entity_id = :entityId", { entityId: options.entityId });
  }

  if (options.startDate) {
    qb.andWhere("l.created_at >= :startDate", { startDate: options.startDate });
  }

  if (options.endDate) {
    qb.andWhere("l.created_at <= :endDate", { endDate: options.endDate });
  }

  qb.orderBy("l.created_at", "DESC").take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get log by ID
 */
export async function getActivityLogById(id: string): Promise<ActivityLogEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get logs by user
 */
export async function getActivityLogsByUser(
  userId: string,
  limit = 50
): Promise<ActivityLogEntity[]> {
  return getRepo()
    .createQueryBuilder("l")
    .where("l.user_id = :userId", { userId })
    .orderBy("l.created_at", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Get logs by entity
 */
export async function getActivityLogsByEntity(
  entityType: ActivityEntityType,
  entityId: string,
  limit = 50
): Promise<ActivityLogEntity[]> {
  return getRepo()
    .createQueryBuilder("l")
    .where("l.entity_type = :entityType", { entityType })
    .andWhere("l.entity_id = :entityId", { entityId })
    .orderBy("l.created_at", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Get recent activity logs
 */
export async function getRecentActivityLogs(limit = 100): Promise<ActivityLogEntity[]> {
  return getRepo()
    .createQueryBuilder("l")
    .orderBy("l.created_at", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Create activity log
 */
export async function createActivityLog(
  data: Partial<ActivityLogEntity>
): Promise<ActivityLogEntity> {
  const log = getRepo().create(data);
  return getRepo().save(log);
}

/**
 * Log activity (convenience method)
 */
export async function logActivity(data: {
  userId?: string | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string | null;
  entityName?: string | null;
  metadata?: Record<string, unknown> | null;
  changes?: Array<{ field: string; old_value: unknown; new_value: unknown }> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ActivityLogEntity> {
  return createActivityLog({
    user_id: data.userId ?? null,
    action: data.action,
    entity_type: data.entityType,
    entity_id: data.entityId ?? null,
    entity_name: data.entityName ?? null,
    metadata: data.metadata ?? null,
    changes: data.changes ?? null,
    ip_address: data.ipAddress ?? null,
    user_agent: data.userAgent ?? null,
  });
}

/**
 * Delete log
 */
export async function deleteActivityLog(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Prune old logs
 */
export async function pruneActivityLogs(daysOld = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await getRepo()
    .createQueryBuilder()
    .delete()
    .where("created_at < :cutoff", { cutoff })
    .execute();

  return result.affected ?? 0;
}

export default {
  listActivityLogs,
  getActivityLogById,
  getActivityLogsByUser,
  getActivityLogsByEntity,
  getRecentActivityLogs,
  createActivityLog,
  logActivity,
  deleteActivityLog,
  pruneActivityLogs,
};
