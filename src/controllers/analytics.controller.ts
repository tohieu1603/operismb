/**
 * Analytics Controller
 * Token usage analytics endpoints
 */

import type { Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/analytics.service";

// ============================================================================
// User Analytics
// ============================================================================

/**
 * Get user's usage overview (today's stats by default)
 * GET /analytics/usage?period=today|week|month|year
 */
export async function getUserUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const period = (req.query.period as string) || "today";

    let stats;
    switch (period) {
      case "week":
        stats = await analyticsService.getUserWeekStats(userId);
        break;
      case "month":
        stats = await analyticsService.getUserMonthStats(userId);
        break;
      case "year":
        stats = await analyticsService.getUserYearStats(userId);
        break;
      case "today":
      default:
        stats = await analyticsService.getUserTodayStats(userId);
        break;
    }

    res.json({ period, ...stats });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's daily usage stats
 * GET /analytics/usage/daily?days=7
 */
export async function getUserDaily(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const days = Math.min(parseInt(req.query.days as string) || 7, 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(0, 0, 0, 0);

    const { stats, byType, daily } = await analyticsService.getUserCustomStats(
      userId,
      startDate,
      endDate,
    );

    res.json({
      period: `last_${days}_days`,
      stats,
      byType,
      daily,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's custom date range stats
 * GET /analytics/usage/range?start=2024-01-01&end=2024-01-31
 */
export async function getUserRange(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const start = req.query.start as string;
    const end = req.query.end as string;

    if (!start || !end) {
      res.status(400).json({ error: "start and end dates are required" });
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() + 1); // Include end date

    const { stats, byType, daily } = await analyticsService.getUserCustomStats(
      userId,
      startDate,
      endDate,
    );

    res.json({
      period: "custom",
      startDate: start,
      endDate: end,
      stats,
      byType,
      daily,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's usage history (individual records)
 * GET /analytics/usage/history?limit=50&offset=0
 */
export async function getUserHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await analyticsService.getUserHistory(userId, limit, offset);

    res.json({
      records: result.records,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Admin Analytics
// ============================================================================

/**
 * Get platform-wide usage overview
 * GET /analytics/admin/overview?period=today|week|month|year
 */
export async function getAdminOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as string) || "today";

    let stats;
    switch (period) {
      case "week":
        stats = await analyticsService.getPlatformWeekStats();
        break;
      case "month":
        stats = await analyticsService.getPlatformMonthStats();
        break;
      case "year":
        stats = await analyticsService.getPlatformYearStats();
        break;
      case "today":
      default:
        stats = await analyticsService.getPlatformTodayStats();
        break;
    }

    res.json({ period, ...stats });
  } catch (error) {
    next(error);
  }
}

/**
 * Get platform daily stats
 * GET /analytics/admin/daily?days=30
 */
export async function getAdminDaily(req: Request, res: Response, next: NextFunction) {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(0, 0, 0, 0);

    const { stats, byType, daily, topUsers } = await analyticsService.getPlatformCustomStats(
      startDate,
      endDate,
    );

    res.json({
      period: `last_${days}_days`,
      stats,
      byType,
      daily,
      topUsers,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get platform custom date range stats
 * GET /analytics/admin/range?start=2024-01-01&end=2024-01-31
 */
export async function getAdminRange(req: Request, res: Response, next: NextFunction) {
  try {
    const start = req.query.start as string;
    const end = req.query.end as string;

    if (!start || !end) {
      res.status(400).json({ error: "start and end dates are required" });
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() + 1);

    const { stats, byType, daily, topUsers } = await analyticsService.getPlatformCustomStats(
      startDate,
      endDate,
    );

    res.json({
      period: "custom",
      startDate: start,
      endDate: end,
      stats,
      byType,
      daily,
      topUsers,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific user's stats (admin)
 * GET /analytics/admin/users/:userId?period=month
 */
export async function getAdminUserStats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId;
    const period = (req.query.period as string) || "month";

    let periodStats;
    switch (period) {
      case "today":
        periodStats = await analyticsService.getUserTodayStats(userId);
        break;
      case "week":
        periodStats = await analyticsService.getUserWeekStats(userId);
        break;
      case "year":
        periodStats = await analyticsService.getUserYearStats(userId);
        break;
      case "month":
      default:
        periodStats = await analyticsService.getUserMonthStats(userId);
        break;
    }

    // Also fetch user history
    const history = await analyticsService.getUserHistory(userId, 20, 0);

    res.json({
      userId,
      period,
      stats: periodStats.current,
      byType: periodStats.byType,
      daily: periodStats.daily,
      history,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all usage records (admin)
 * GET /analytics/admin/history?userId=&requestType=&limit=50&offset=0
 */
export async function getAdminHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.query.userId as string | undefined;
    const requestType = req.query.requestType as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const options: {
      userId?: string;
      requestType?: string;
      startDate?: Date;
      endDate?: Date;
      limit: number;
      offset: number;
    } = { limit, offset };

    if (userId) options.userId = userId;
    if (requestType) options.requestType = requestType;
    if (start) options.startDate = new Date(start);
    if (end) {
      options.endDate = new Date(end);
      options.endDate.setDate(options.endDate.getDate() + 1);
    }

    const result = await analyticsService.getAllHistory(options);

    res.json({
      records: result.records,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
}
