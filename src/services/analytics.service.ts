/**
 * Analytics Service
 * Token usage analytics and statistics
 */

import { tokenUsageRepo } from "../db/models/index.js";
import type {
  TokenUsageCreate,
  TokenUsageStats,
  TokenUsageByType,
  TokenUsageByDate,
  TokenUsageByUser,
  TokenUsage,
} from "../db/models/types.js";

// ============================================================================
// Date Range Helpers
// ============================================================================

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfYear(date: Date): Date {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ============================================================================
// Record Usage
// ============================================================================

/**
 * Record a token usage event
 */
async function recordUsage(data: TokenUsageCreate): Promise<TokenUsage> {
  return tokenUsageRepo.recordUsage(data);
}

// ============================================================================
// User Analytics
// ============================================================================

interface PeriodStats {
  current: TokenUsageStats;
  previous: TokenUsageStats;
  byType: TokenUsageByType[];
  daily: TokenUsageByDate[];
}

/**
 * Get user's usage for today
 */
async function getUserTodayStats(userId: string): Promise<PeriodStats> {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);

  const [current, previous, byType, daily] = await Promise.all([
    tokenUsageRepo.getUserStats(userId, todayStart, todayEnd),
    tokenUsageRepo.getUserStats(userId, yesterdayStart, todayStart),
    tokenUsageRepo.getUserStatsByType(userId, todayStart, todayEnd),
    tokenUsageRepo.getUserDailyStats(userId, addDays(todayStart, -7), todayEnd),
  ]);

  return { current, previous, byType, daily };
}

/**
 * Get user's usage for this week
 */
async function getUserWeekStats(userId: string): Promise<PeriodStats> {
  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const prevWeekStart = addDays(weekStart, -7);

  const [current, previous, byType, daily] = await Promise.all([
    tokenUsageRepo.getUserStats(userId, weekStart, weekEnd),
    tokenUsageRepo.getUserStats(userId, prevWeekStart, weekStart),
    tokenUsageRepo.getUserStatsByType(userId, weekStart, weekEnd),
    tokenUsageRepo.getUserDailyStats(userId, weekStart, weekEnd),
  ]);

  return { current, previous, byType, daily };
}

/**
 * Get user's usage for this month
 */
async function getUserMonthStats(userId: string): Promise<PeriodStats> {
  const now = new Date();
  const monthStart = getStartOfMonth(now);
  const monthEnd = addDays(getStartOfMonth(addDays(monthStart, 32)), 0);
  const prevMonthStart = getStartOfMonth(addDays(monthStart, -1));

  const [current, previous, byType, daily] = await Promise.all([
    tokenUsageRepo.getUserStats(userId, monthStart, monthEnd),
    tokenUsageRepo.getUserStats(userId, prevMonthStart, monthStart),
    tokenUsageRepo.getUserStatsByType(userId, monthStart, monthEnd),
    tokenUsageRepo.getUserDailyStats(userId, monthStart, monthEnd),
  ]);

  return { current, previous, byType, daily };
}

/**
 * Get user's usage for this year
 */
async function getUserYearStats(userId: string): Promise<PeriodStats> {
  const now = new Date();
  const yearStart = getStartOfYear(now);
  const yearEnd = addDays(getStartOfYear(addDays(yearStart, 366)), 0);
  const prevYearStart = getStartOfYear(addDays(yearStart, -1));

  const [current, previous, byType, daily] = await Promise.all([
    tokenUsageRepo.getUserStats(userId, yearStart, yearEnd),
    tokenUsageRepo.getUserStats(userId, prevYearStart, yearStart),
    tokenUsageRepo.getUserStatsByType(userId, yearStart, yearEnd),
    tokenUsageRepo.getUserDailyStats(userId, addDays(now, -30), yearEnd), // Last 30 days for daily
  ]);

  return { current, previous, byType, daily };
}

/**
 * Get user's custom date range stats
 */
async function getUserCustomStats(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ stats: TokenUsageStats; byType: TokenUsageByType[]; daily: TokenUsageByDate[] }> {
  const [stats, byType, daily] = await Promise.all([
    tokenUsageRepo.getUserStats(userId, startDate, endDate),
    tokenUsageRepo.getUserStatsByType(userId, startDate, endDate),
    tokenUsageRepo.getUserDailyStats(userId, startDate, endDate),
  ]);

  return { stats, byType, daily };
}

/**
 * Get user's usage history
 */
async function getUserHistory(
  userId: string,
  limit?: number,
  offset?: number,
): Promise<{ records: TokenUsage[]; total: number }> {
  return tokenUsageRepo.getUserUsageHistory(userId, limit, offset);
}

// ============================================================================
// Admin/Platform Analytics
// ============================================================================

interface PlatformPeriodStats {
  current: TokenUsageStats;
  previous: TokenUsageStats;
  byType: TokenUsageByType[];
  daily: TokenUsageByDate[];
  topUsers: TokenUsageByUser[];
}

/**
 * Get platform stats for today
 */
async function getPlatformTodayStats(): Promise<PlatformPeriodStats> {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);

  const [current, previous, byType, daily, topUsers] = await Promise.all([
    tokenUsageRepo.getPlatformStats(todayStart, todayEnd),
    tokenUsageRepo.getPlatformStats(yesterdayStart, todayStart),
    tokenUsageRepo.getPlatformStatsByType(todayStart, todayEnd),
    tokenUsageRepo.getPlatformDailyStats(addDays(todayStart, -7), todayEnd),
    tokenUsageRepo.getTopUsers(todayStart, todayEnd),
  ]);

  return { current, previous, byType, daily, topUsers };
}

/**
 * Get platform stats for this week
 */
async function getPlatformWeekStats(): Promise<PlatformPeriodStats> {
  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const prevWeekStart = addDays(weekStart, -7);

  const [current, previous, byType, daily, topUsers] = await Promise.all([
    tokenUsageRepo.getPlatformStats(weekStart, weekEnd),
    tokenUsageRepo.getPlatformStats(prevWeekStart, weekStart),
    tokenUsageRepo.getPlatformStatsByType(weekStart, weekEnd),
    tokenUsageRepo.getPlatformDailyStats(weekStart, weekEnd),
    tokenUsageRepo.getTopUsers(weekStart, weekEnd),
  ]);

  return { current, previous, byType, daily, topUsers };
}

/**
 * Get platform stats for this month
 */
async function getPlatformMonthStats(): Promise<PlatformPeriodStats> {
  const now = new Date();
  const monthStart = getStartOfMonth(now);
  const monthEnd = addDays(getStartOfMonth(addDays(monthStart, 32)), 0);
  const prevMonthStart = getStartOfMonth(addDays(monthStart, -1));

  const [current, previous, byType, daily, topUsers] = await Promise.all([
    tokenUsageRepo.getPlatformStats(monthStart, monthEnd),
    tokenUsageRepo.getPlatformStats(prevMonthStart, monthStart),
    tokenUsageRepo.getPlatformStatsByType(monthStart, monthEnd),
    tokenUsageRepo.getPlatformDailyStats(monthStart, monthEnd),
    tokenUsageRepo.getTopUsers(monthStart, monthEnd),
  ]);

  return { current, previous, byType, daily, topUsers };
}

/**
 * Get platform stats for this year
 */
async function getPlatformYearStats(): Promise<PlatformPeriodStats> {
  const now = new Date();
  const yearStart = getStartOfYear(now);
  const yearEnd = addDays(getStartOfYear(addDays(yearStart, 366)), 0);
  const prevYearStart = getStartOfYear(addDays(yearStart, -1));

  const [current, previous, byType, daily, topUsers] = await Promise.all([
    tokenUsageRepo.getPlatformStats(yearStart, yearEnd),
    tokenUsageRepo.getPlatformStats(prevYearStart, yearStart),
    tokenUsageRepo.getPlatformStatsByType(yearStart, yearEnd),
    tokenUsageRepo.getPlatformDailyStats(addDays(now, -30), yearEnd),
    tokenUsageRepo.getTopUsers(yearStart, yearEnd),
  ]);

  return { current, previous, byType, daily, topUsers };
}

/**
 * Get platform custom date range stats
 */
async function getPlatformCustomStats(
  startDate: Date,
  endDate: Date,
): Promise<{
  stats: TokenUsageStats;
  byType: TokenUsageByType[];
  daily: TokenUsageByDate[];
  topUsers: TokenUsageByUser[];
}> {
  const [stats, byType, daily, topUsers] = await Promise.all([
    tokenUsageRepo.getPlatformStats(startDate, endDate),
    tokenUsageRepo.getPlatformStatsByType(startDate, endDate),
    tokenUsageRepo.getPlatformDailyStats(startDate, endDate),
    tokenUsageRepo.getTopUsers(startDate, endDate),
  ]);

  return { stats, byType, daily, topUsers };
}

/**
 * Get all usage history (admin)
 */
async function getAllHistory(options?: {
  userId?: string;
  requestType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ records: (TokenUsage & { user_email: string; user_name: string })[]; total: number }> {
  return tokenUsageRepo.getAllUsageHistory(options);
}

export const analyticsService = {
  // Record
  recordUsage,
  // User stats
  getUserTodayStats,
  getUserWeekStats,
  getUserMonthStats,
  getUserYearStats,
  getUserCustomStats,
  getUserHistory,
  // Platform stats (admin)
  getPlatformTodayStats,
  getPlatformWeekStats,
  getPlatformMonthStats,
  getPlatformYearStats,
  getPlatformCustomStats,
  getAllHistory,
};
