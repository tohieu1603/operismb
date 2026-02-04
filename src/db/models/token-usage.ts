/**
 * Token Usage Repository
 * Track and query token usage analytics
 */

import { queryOne, queryAll } from "../connection.js";
import type {
  TokenUsage,
  TokenUsageCreate,
  TokenUsageStats,
  TokenUsageByType,
  TokenUsageByDate,
  TokenUsageByUser,
} from "./types.js";

// ============================================================================
// Create Usage Record
// ============================================================================

/**
 * Record a token usage event
 */
export async function recordUsage(data: TokenUsageCreate): Promise<TokenUsage> {
  const totalTokens = data.total_tokens ?? data.input_tokens + data.output_tokens;
  const costTokens = data.cost_tokens ?? totalTokens;

  const result = await queryOne<TokenUsage>(
    `INSERT INTO token_usage (
      user_id, request_type, request_id, model,
      input_tokens, output_tokens, total_tokens, cost_tokens, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      data.user_id,
      data.request_type,
      data.request_id ?? null,
      data.model ?? null,
      data.input_tokens,
      data.output_tokens,
      totalTokens,
      costTokens,
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  if (!result) {
    throw new Error("Failed to record token usage");
  }

  return result;
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
  const result = await queryOne<{
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }>(
    `SELECT
      COUNT(*)::text as total_requests,
      COALESCE(SUM(input_tokens), 0)::text as total_input_tokens,
      COALESCE(SUM(output_tokens), 0)::text as total_output_tokens,
      COALESCE(SUM(total_tokens), 0)::text as total_tokens,
      COALESCE(SUM(cost_tokens), 0)::text as total_cost_tokens
    FROM token_usage
    WHERE user_id = $1 AND created_at >= $2 AND created_at < $3`,
    [userId, startDate, endDate],
  );

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
  const results = await queryAll<{
    request_type: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }>(
    `SELECT
      request_type,
      COUNT(*)::text as total_requests,
      COALESCE(SUM(input_tokens), 0)::text as total_input_tokens,
      COALESCE(SUM(output_tokens), 0)::text as total_output_tokens,
      COALESCE(SUM(total_tokens), 0)::text as total_tokens,
      COALESCE(SUM(cost_tokens), 0)::text as total_cost_tokens
    FROM token_usage
    WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
    GROUP BY request_type
    ORDER BY total_tokens DESC`,
    [userId, startDate, endDate],
  );

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
  const results = await queryAll<{
    date: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }>(
    `SELECT
      DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::text as date,
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

  return results.map((r) => ({
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
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM token_usage WHERE user_id = $1`,
    [userId],
  );

  const records = await queryAll<TokenUsage>(
    `SELECT * FROM token_usage
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return {
    records,
    total: parseInt(countResult?.count ?? "0", 10),
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
  const result = await queryOne<{
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }>(
    `SELECT
      COUNT(*)::text as total_requests,
      COALESCE(SUM(input_tokens), 0)::text as total_input_tokens,
      COALESCE(SUM(output_tokens), 0)::text as total_output_tokens,
      COALESCE(SUM(total_tokens), 0)::text as total_tokens,
      COALESCE(SUM(cost_tokens), 0)::text as total_cost_tokens
    FROM token_usage
    WHERE created_at >= $1 AND created_at < $2`,
    [startDate, endDate],
  );

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
  const results = await queryAll<{
    request_type: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }>(
    `SELECT
      request_type,
      COUNT(*)::text as total_requests,
      COALESCE(SUM(input_tokens), 0)::text as total_input_tokens,
      COALESCE(SUM(output_tokens), 0)::text as total_output_tokens,
      COALESCE(SUM(total_tokens), 0)::text as total_tokens,
      COALESCE(SUM(cost_tokens), 0)::text as total_cost_tokens
    FROM token_usage
    WHERE created_at >= $1 AND created_at < $2
    GROUP BY request_type
    ORDER BY total_tokens DESC`,
    [startDate, endDate],
  );

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
  const results = await queryAll<{
    date: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }>(
    `SELECT
      DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::text as date,
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

  return results.map((r) => ({
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
  const results = await queryAll<{
    user_id: string;
    user_email: string;
    user_name: string;
    total_requests: string;
    total_input_tokens: string;
    total_output_tokens: string;
    total_tokens: string;
    total_cost_tokens: string;
  }>(
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

  return results.map((r) => ({
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
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.userId) {
    params.push(options.userId);
    conditions.push(`tu.user_id = $${params.length}`);
  }
  if (options.requestType) {
    params.push(options.requestType);
    conditions.push(`tu.request_type = $${params.length}`);
  }
  if (options.startDate) {
    params.push(options.startDate);
    conditions.push(`tu.created_at >= $${params.length}`);
  }
  if (options.endDate) {
    params.push(options.endDate);
    conditions.push(`tu.created_at < $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM token_usage tu ${whereClause}`,
    params,
  );

  const records = await queryAll<TokenUsage & { user_email: string; user_name: string }>(
    `SELECT tu.*, u.email as user_email, u.name as user_name
    FROM token_usage tu
    JOIN users u ON tu.user_id = u.id
    ${whereClause}
    ORDER BY tu.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    records,
    total: parseInt(countResult?.count ?? "0", 10),
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
