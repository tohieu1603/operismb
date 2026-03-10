/**
 * Post Analytics Repository
 * CRUD operations for post_analytics_events and post_daily_stats tables
 */

import { AppDataSource } from "../data-source";
import {
  PostAnalyticsEntity,
  PostDailyStatsEntity,
  AnalyticsEventType,
  AnalyticsEntityType,
} from "../entities/post-analytics.entity";

function getEventsRepo() {
  return AppDataSource.getRepository(PostAnalyticsEntity);
}

function getStatsRepo() {
  return AppDataSource.getRepository(PostDailyStatsEntity);
}

/**
 * Record analytics event
 */
export async function recordEvent(data: Partial<PostAnalyticsEntity>): Promise<PostAnalyticsEntity> {
  const event = getEventsRepo().create(data);
  return getEventsRepo().save(event);
}

/**
 * List events with pagination
 */
export async function listEvents(options: {
  page?: number;
  limit?: number;
  entityId?: string;
  entityType?: AnalyticsEntityType;
  eventType?: AnalyticsEventType;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<{ data: PostAnalyticsEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 200);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const qb = getEventsRepo().createQueryBuilder("e");

  if (options.entityId) {
    qb.andWhere("e.entity_id = :entityId", { entityId: options.entityId });
  }

  if (options.entityType) {
    qb.andWhere("e.entity_type = :entityType", { entityType: options.entityType });
  }

  if (options.eventType) {
    qb.andWhere("e.event_type = :eventType", { eventType: options.eventType });
  }

  if (options.startDate) {
    qb.andWhere("e.created_at >= :startDate", { startDate: options.startDate });
  }

  if (options.endDate) {
    qb.andWhere("e.created_at <= :endDate", { endDate: options.endDate });
  }

  qb.orderBy("e.created_at", "DESC").take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get event counts by type for an entity
 */
export async function getEventCountsByEntity(
  entityId: string,
  startDate?: Date
): Promise<Record<string, number>> {
  const qb = getEventsRepo()
    .createQueryBuilder("e")
    .select("e.event_type", "eventType")
    .addSelect("COUNT(*)", "count")
    .where("e.entity_id = :entityId", { entityId })
    .groupBy("e.event_type");

  if (startDate) {
    qb.andWhere("e.created_at >= :startDate", { startDate });
  }

  const results = await qb.getRawMany();
  const counts: Record<string, number> = {};
  results.forEach((r: { eventType: string; count: string }) => {
    counts[r.eventType] = parseInt(r.count, 10);
  });
  return counts;
}

/**
 * Get daily stats for an entity
 */
export async function getDailyStats(
  entityId: string,
  entityType: string,
  startDate?: Date
): Promise<PostDailyStatsEntity[]> {
  const qb = getStatsRepo()
    .createQueryBuilder("s")
    .where("s.entity_id = :entityId", { entityId })
    .andWhere("s.entity_type = :entityType", { entityType });

  if (startDate) {
    qb.andWhere("s.date >= :startDate", { startDate });
  }

  return qb.orderBy("s.date", "ASC").getMany();
}

/**
 * Upsert daily stats
 */
export async function upsertDailyStats(data: {
  date: Date;
  entityType: "post" | "category" | "page";
  entityId?: string;
  entitySlug?: string;
  totalViews?: number;
  uniqueViews?: number;
}): Promise<PostDailyStatsEntity> {
  const existing = await getStatsRepo()
    .createQueryBuilder("s")
    .where("s.date = :date", { date: data.date })
    .andWhere("s.entity_type = :entityType", { entityType: data.entityType })
    .andWhere("s.entity_id = :entityId", { entityId: data.entityId ?? null })
    .getOne();

  if (existing) {
    await getStatsRepo().update(
      { id: existing.id },
      {
        total_views: (existing.total_views ?? 0) + (data.totalViews ?? 0),
        unique_views: (existing.unique_views ?? 0) + (data.uniqueViews ?? 0),
      }
    );
    return getStatsRepo().findOneBy({ id: existing.id }) as Promise<PostDailyStatsEntity>;
  }

  const stats = getStatsRepo().create({
    date: data.date,
    entity_type: data.entityType,
    entity_id: data.entityId ?? null,
    entity_slug: data.entitySlug ?? null,
    total_views: data.totalViews ?? 0,
    unique_views: data.uniqueViews ?? 0,
  });
  return getStatsRepo().save(stats);
}

/**
 * Get overview analytics
 */
export async function getOverview(days = 30): Promise<{
  eventsByType: Array<{ type: string; count: number }>;
  topPosts: Array<{ entityId: string | null; entitySlug: string | null; totalViews: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const eventsByType = await getEventsRepo()
    .createQueryBuilder("e")
    .select("e.event_type", "type")
    .addSelect("COUNT(*)", "count")
    .where("e.created_at >= :startDate", { startDate })
    .groupBy("e.event_type")
    .orderBy("count", "DESC")
    .getRawMany();

  const topPosts = await getStatsRepo()
    .createQueryBuilder("s")
    .select("s.entity_id", "entityId")
    .addSelect("s.entity_slug", "entitySlug")
    .addSelect("SUM(s.total_views)", "totalViews")
    .where("s.entity_type = :entityType", { entityType: "post" })
    .andWhere("s.date >= :startDate", { startDate })
    .groupBy("s.entity_id")
    .addGroupBy("s.entity_slug")
    .orderBy('"totalViews"', "DESC")
    .take(10)
    .getRawMany();

  return {
    eventsByType: eventsByType.map((e: { type: string; count: string }) => ({
      type: e.type,
      count: parseInt(e.count, 10),
    })),
    topPosts: topPosts.map((p: { entityId: string | null; entitySlug: string | null; totalViews: string }) => ({
      entityId: p.entityId,
      entitySlug: p.entitySlug,
      totalViews: parseInt(p.totalViews, 10),
    })),
  };
}

export default {
  recordEvent,
  listEvents,
  getEventCountsByEntity,
  getDailyStats,
  upsertDailyStats,
  getOverview,
};
