/**
 * SEO Logs Repository
 * CRUD operations for seo_logs table
 */

import { AppDataSource } from "../data-source";
import { SeoLogEntity, SeoLogAction, SeoLogEntityType, SeoLogStatus } from "../entities/seo-log.entity";

function getRepo() {
  return AppDataSource.getRepository(SeoLogEntity);
}

export interface SeoLogListOptions {
  page?: number;
  limit?: number;
  action?: SeoLogAction;
  entityType?: SeoLogEntityType;
  entityId?: string;
  status?: SeoLogStatus;
  isScheduled?: boolean;
}

/**
 * List SEO logs with pagination
 */
export async function listSeoLogs(
  options: SeoLogListOptions = {}
): Promise<{ data: SeoLogEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const qb = getRepo().createQueryBuilder("l");

  if (options.action) {
    qb.andWhere("l.action = :action", { action: options.action });
  }

  if (options.entityType) {
    qb.andWhere("l.entity_type = :entityType", { entityType: options.entityType });
  }

  if (options.entityId) {
    qb.andWhere("l.entity_id = :entityId", { entityId: options.entityId });
  }

  if (options.status) {
    qb.andWhere("l.status = :status", { status: options.status });
  }

  if (options.isScheduled !== undefined) {
    qb.andWhere("l.is_scheduled = :isScheduled", { isScheduled: options.isScheduled });
  }

  qb.orderBy("l.created_at", "DESC").take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get log by ID
 */
export async function getSeoLogById(id: string): Promise<SeoLogEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get logs by entity
 */
export async function getSeoLogsByEntity(
  entityType: SeoLogEntityType,
  entityId: string,
  limit = 50
): Promise<SeoLogEntity[]> {
  return getRepo()
    .createQueryBuilder("l")
    .where("l.entity_type = :entityType", { entityType })
    .andWhere("l.entity_id = :entityId", { entityId })
    .orderBy("l.created_at", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Create SEO log
 */
export async function createSeoLog(data: Partial<SeoLogEntity>): Promise<SeoLogEntity> {
  const log = getRepo().create(data);
  return getRepo().save(log);
}

/**
 * Delete log
 */
export async function deleteSeoLog(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Prune old logs (keep latest N per entity)
 */
export async function pruneLogs(daysOld = 90): Promise<number> {
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
  listSeoLogs,
  getSeoLogById,
  getSeoLogsByEntity,
  createSeoLog,
  deleteSeoLog,
  pruneLogs,
};
