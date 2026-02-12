/**
 * Token Usage Repository
 * Track and query token usage analytics
 */

import { AppDataSource } from "../data-source.js";
import { TokenUsageEntity } from "../entities/token-usage.entity.js";
import { UserEntity } from "../entities/user.entity.js";
import type {
  TokenUsage,
  TokenUsageCreate,
  TokenUsageStats,
  TokenUsageByType,
  TokenUsageByDate,
  TokenUsageByUser,
} from "./types.js";

const getRepo = () => AppDataSource.getRepository(TokenUsageEntity);

// ============================================================================
// Create Usage Record
// ============================================================================

/**
 * Record a token usage event
 */
export async function recordUsage(data: TokenUsageCreate): Promise<TokenUsage> {
  const totalTokens = data.total_tokens ?? data.input_tokens + data.output_tokens;
  const costTokens = data.cost_tokens ?? totalTokens;

  const entity = getRepo().create({
    user_id: data.user_id,
    request_type: data.request_type,
    request_id: data.request_id ?? null,
    model: data.model ?? null,
    input_tokens: data.input_tokens,
    output_tokens: data.output_tokens,
    total_tokens: totalTokens,
    cost_tokens: costTokens,
    metadata: data.metadata ?? {},
  });

  const saved = await getRepo().save(entity);

  return {
    id: saved.id,
    user_id: saved.user_id,
    request_type: saved.request_type,
    request_id: saved.request_id,
    model: saved.model,
    input_tokens: saved.input_tokens,
    output_tokens: saved.output_tokens,
    total_tokens: saved.total_tokens,
    cost_tokens: saved.cost_tokens,
    metadata: saved.metadata,
    created_at: saved.created_at,
  };
}

// ============================================================================
// Query Usage - User Level
// ============================================================================

/**
 * Get user's usage summary for a date range
 */
export async function getUserStats(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<TokenUsageStats> {
  const result = await getRepo()
    .createQueryBuilder("tu")
    .select("COUNT(*)::text", "total_requests")
    .addSelect("COALESCE(SUM(tu.input_tokens), 0)::text", "total_input_tokens")
    .addSelect("COALESCE(SUM(tu.output_tokens), 0)::text", "total_output_tokens")
    .addSelect("COALESCE(SUM(tu.total_tokens), 0)::text", "total_tokens")
    .addSelect("COALESCE(SUM(tu.cost_tokens), 0)::text", "total_cost_tokens")
    .where("tu.user_id = :userId", { userId })
    .andWhere("tu.created_at >= :from", { from: startDate })
    .andWhere("tu.created_at < :to", { to: endDate })
    .getRawOne();

  return {
    total_requests: parseInt(result?.total_requests ?? "0", 10),
    total_input_tokens: parseInt(result?.total_input_tokens ?? "0", 10),
    total_output_tokens: parseInt(result?.total_output_tokens ?? "0", 10),
    total_tokens: parseInt(result?.total_tokens ?? "0", 10),
    total_cost_tokens: parseInt(result?.total_cost_tokens ?? "0", 10),
  };
}

/**
 * Get user's usage breakdown by request type
 */
export async function getUserStatsByType(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<TokenUsageByType[]> {
  const results = await getRepo()
    .createQueryBuilder("tu")
    .select("tu.request_type", "request_type")
    .addSelect("COUNT(*)::text", "total_requests")
    .addSelect("COALESCE(SUM(tu.input_tokens), 0)::text", "total_input_tokens")
    .addSelect("COALESCE(SUM(tu.output_tokens), 0)::text", "total_output_tokens")
    .addSelect("COALESCE(SUM(tu.total_tokens), 0)::text", "total_tokens")
    .addSelect("COALESCE(SUM(tu.cost_tokens), 0)::text", "total_cost_tokens")
    .where("tu.user_id = :userId", { userId })
    .andWhere("tu.created_at >= :from", { from: startDate })
    .andWhere("tu.created_at < :to", { to: endDate })
    .groupBy("tu.request_type")
    .orderBy("total_tokens", "DESC")
    .getRawMany();

  return results.map((r) => ({
    request_type: r.request_type as TokenUsageByType["request_type"],
    total_requests: parseInt(r.total_requests, 10),
    total_input_tokens: parseInt(r.total_input_tokens, 10),
    total_output_tokens: parseInt(r.total_output_tokens, 10),
    total_tokens: parseInt(r.total_tokens, 10),
    total_cost_tokens: parseInt(r.total_cost_tokens, 10),
  }));
}

/**
 * Get user's daily usage for a date range
 */
export async function getUserDailyStats(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<TokenUsageByDate[]> {
  const results = await AppDataSource.query(
    `SELECT DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::text as date,
     COUNT(*)::text as total_requests,
     COALESCE(SUM(input_tokens), 0)::text as total_input_tokens,
     COALESCE(SUM(output_tokens), 0)::text as total_output_tokens,
     COALESCE(SUM(total_tokens), 0)::text as total_tokens,
     COALESCE(SUM(cost_tokens), 0)::text as total_cost_tokens
     FROM token_usage
     WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
     GROUP BY DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
     ORDER BY date DESC`,
    [userId, startDate, endDate],
  );

  return results.map((r: {
    date: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }) => ({
    date: r.date,
    total_requests: parseInt(r.total_requests, 10),
    total_input_tokens: parseInt(r.total_input_tokens, 10),
    total_output_tokens: parseInt(r.total_output_tokens, 10),
    total_tokens: parseInt(r.total_tokens, 10),
    total_cost_tokens: parseInt(r.total_cost_tokens, 10),
  }));
}

/**
 * Get user's recent usage records
 */
export async function getUserUsageHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ records: TokenUsage[]; total: number }> {
  const [records, total] = await getRepo().findAndCount({
    where: { user_id: userId },
    order: { created_at: "DESC" },
    take: limit,
    skip: offset,
  });

  return {
    records: records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      request_type: r.request_type,
      request_id: r.request_id,
      model: r.model,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      total_tokens: r.total_tokens,
      cost_tokens: r.cost_tokens,
      metadata: r.metadata,
      created_at: r.created_at,
    })),
    total,
  };
}

// ============================================================================
// Query Usage - Admin Level
// ============================================================================

/**
 * Get overall platform stats for a date range
 */
export async function getPlatformStats(
  startDate: Date,
  endDate: Date,
): Promise<TokenUsageStats> {
  const result = await getRepo()
    .createQueryBuilder("tu")
    .select("COUNT(*)::text", "total_requests")
    .addSelect("COALESCE(SUM(tu.input_tokens), 0)::text", "total_input_tokens")
    .addSelect("COALESCE(SUM(tu.output_tokens), 0)::text", "total_output_tokens")
    .addSelect("COALESCE(SUM(tu.total_tokens), 0)::text", "total_tokens")
    .addSelect("COALESCE(SUM(tu.cost_tokens), 0)::text", "total_cost_tokens")
    .where("tu.created_at >= :from", { from: startDate })
    .andWhere("tu.created_at < :to", { to: endDate })
    .getRawOne();

  return {
    total_requests: parseInt(result?.total_requests ?? "0", 10),
    total_input_tokens: parseInt(result?.total_input_tokens ?? "0", 10),
    total_output_tokens: parseInt(result?.total_output_tokens ?? "0", 10),
    total_tokens: parseInt(result?.total_tokens ?? "0", 10),
    total_cost_tokens: parseInt(result?.total_cost_tokens ?? "0", 10),
  };
}

/**
 * Get platform stats by request type
 */
export async function getPlatformStatsByType(
  startDate: Date,
  endDate: Date,
): Promise<TokenUsageByType[]> {
  const results = await getRepo()
    .createQueryBuilder("tu")
    .select("tu.request_type", "request_type")
    .addSelect("COUNT(*)::text", "total_requests")
    .addSelect("COALESCE(SUM(tu.input_tokens), 0)::text", "total_input_tokens")
    .addSelect("COALESCE(SUM(tu.output_tokens), 0)::text", "total_output_tokens")
    .addSelect("COALESCE(SUM(tu.total_tokens), 0)::text", "total_tokens")
    .addSelect("COALESCE(SUM(tu.cost_tokens), 0)::text", "total_cost_tokens")
    .where("tu.created_at >= :from", { from: startDate })
    .andWhere("tu.created_at < :to", { to: endDate })
    .groupBy("tu.request_type")
    .orderBy("total_tokens", "DESC")
    .getRawMany();

  return results.map((r) => ({
    request_type: r.request_type as TokenUsageByType["request_type"],
    total_requests: parseInt(r.total_requests, 10),
    total_input_tokens: parseInt(r.total_input_tokens, 10),
    total_output_tokens: parseInt(r.total_output_tokens, 10),
    total_tokens: parseInt(r.total_tokens, 10),
    total_cost_tokens: parseInt(r.total_cost_tokens, 10),
  }));
}

/**
 * Get daily platform stats
 */
export async function getPlatformDailyStats(
  startDate: Date,
  endDate: Date,
): Promise<TokenUsageByDate[]> {
  const results = await AppDataSource.query(
    `SELECT DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::text as date,
     COUNT(*)::text as total_requests,
     COALESCE(SUM(input_tokens), 0)::text as total_input_tokens,
     COALESCE(SUM(output_tokens), 0)::text as total_output_tokens,
     COALESCE(SUM(total_tokens), 0)::text as total_tokens,
     COALESCE(SUM(cost_tokens), 0)::text as total_cost_tokens
     FROM token_usage
     WHERE created_at >= $1 AND created_at < $2
     GROUP BY DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
     ORDER BY date DESC`,
    [startDate, endDate],
  );

  return results.map((r: {
    date: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }) => ({
    date: r.date,
    total_requests: parseInt(r.total_requests, 10),
    total_input_tokens: parseInt(r.total_input_tokens, 10),
    total_output_tokens: parseInt(r.total_output_tokens, 10),
    total_tokens: parseInt(r.total_tokens, 10),
    total_cost_tokens: parseInt(r.total_cost_tokens, 10),
  }));
}

/**
 * Get top users by token usage
 */
export async function getTopUsers(
  startDate: Date,
  endDate: Date,
  limit: number = 20,
): Promise<TokenUsageByUser[]> {
  const results = await AppDataSource.query(
    `SELECT
      tu.user_id,
      u.email as user_email,
      u.name as user_name,
      COUNT(*)::text as total_requests,
      COALESCE(SUM(tu.input_tokens), 0)::text as total_input_tokens,
      COALESCE(SUM(tu.output_tokens), 0)::text as total_output_tokens,
      COALESCE(SUM(tu.total_tokens), 0)::text as total_tokens,
      COALESCE(SUM(tu.cost_tokens), 0)::text as total_cost_tokens
    FROM token_usage tu
    JOIN users u ON tu.user_id = u.id
    WHERE tu.created_at >= $1 AND tu.created_at < $2
    GROUP BY tu.user_id, u.email, u.name
    ORDER BY total_tokens DESC
    LIMIT $3`,
    [startDate, endDate, limit],
  );

  return results.map((r: {
    user_id: string;
    user_email: string;
    user_name: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }) => ({
    user_id: r.user_id,
    user_email: r.user_email,
    user_name: r.user_name,
    total_requests: parseInt(r.total_requests, 10),
    total_input_tokens: parseInt(r.total_input_tokens, 10),
    total_output_tokens: parseInt(r.total_output_tokens, 10),
    total_tokens: parseInt(r.total_tokens, 10),
    total_cost_tokens: parseInt(r.total_cost_tokens, 10),
  }));
}

/**
 * Get all usage records (admin)
 */
export async function getAllUsageHistory(
  options: {
    userId?: string;
    requestType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ records: (TokenUsage & { user_email: string; user_name: string })[]; total: number }> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const qb = getRepo()
    .createQueryBuilder("tu")
    .innerJoin("tu.user", "u")
    .select("tu.*")
    .addSelect("u.email", "user_email")
    .addSelect("u.name", "user_name");

  if (options.userId) {
    qb.andWhere("tu.user_id = :userId", { userId: options.userId });
  }
  if (options.requestType) {
    qb.andWhere("tu.request_type = :requestType", { requestType: options.requestType });
  }
  if (options.startDate) {
    qb.andWhere("tu.created_at >= :startDate", { startDate: options.startDate });
  }
  if (options.endDate) {
    qb.andWhere("tu.created_at < :endDate", { endDate: options.endDate });
  }

  const total = await qb.getCount();

  const records = await qb
    .orderBy("tu.created_at", "DESC")
    .offset(offset)
    .limit(limit)
    .getRawMany();

  return {
    records: records.map((r: any) => ({
      id: r.tu_id ?? r.id,
      user_id: r.tu_user_id ?? r.user_id,
      request_type: r.tu_request_type ?? r.request_type,
      request_id: r.tu_request_id ?? r.request_id,
      model: r.tu_model ?? r.model,
      input_tokens: r.tu_input_tokens ?? r.input_tokens,
      output_tokens: r.tu_output_tokens ?? r.output_tokens,
      total_tokens: r.tu_total_tokens ?? r.total_tokens,
      cost_tokens: r.tu_cost_tokens ?? r.cost_tokens,
      metadata: r.tu_metadata ?? r.metadata,
      created_at: r.tu_created_at ?? r.created_at,
      user_email: r.user_email,
      user_name: r.user_name,
    })),
    total,
  };
}

export default {
  recordUsage,
  getUserStats,
  getUserStatsByType,
  getUserDailyStats,
  getUserUsageHistory,
  getPlatformStats,
  getPlatformStatsByType,
  getPlatformDailyStats,
  getTopUsers,
  getAllUsageHistory,
};
