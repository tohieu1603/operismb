/**
 * Post Analytics Controller
 * Handles HTTP requests for post analytics
 */

import type { Request, Response } from "express";
import * as postAnalyticsRepo from "../db/models/post-analytics";
import { AnalyticsEventType, AnalyticsEntityType } from "../db/entities/post-analytics.entity";

class PostAnalyticsController {
  async recordEvent(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.eventType && !body.event_type) {
      res.status(400).json({ error: "eventType is required" });
      return;
    }
    if (!body.entityType && !body.entity_type) {
      res.status(400).json({ error: "entityType is required" });
      return;
    }

    const event = await postAnalyticsRepo.recordEvent({
      event_type: body.eventType ?? body.event_type,
      entity_type: body.entityType ?? body.entity_type,
      entity_id: body.entityId ?? body.entity_id ?? null,
      entity_slug: body.entitySlug ?? body.entity_slug ?? null,
      session_id: body.sessionId ?? body.session_id ?? "unknown",
      ip_address:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        (req.socket?.remoteAddress ?? null),
      user_agent: req.headers["user-agent"] ?? null,
      referrer: req.headers.referer ?? body.referrer ?? null,
      date: new Date(),
      metadata: body.metadata ?? null,
    });

    res.status(201).json(event);
  }

  async listEvents(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const entityId = req.query.entityId as string | undefined;
    const entityType = req.query.entityType as AnalyticsEntityType | undefined;
    const eventType = req.query.eventType as AnalyticsEventType | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const result = await postAnalyticsRepo.listEvents({
      page,
      limit,
      entityId,
      entityType,
      eventType,
      startDate,
      endDate,
    });

    res.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  }

  async getPostAnalytics(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [eventCounts, dailyStats] = await Promise.all([
      postAnalyticsRepo.getEventCountsByEntity(postId, startDate),
      postAnalyticsRepo.getDailyStats(postId, "post", startDate),
    ]);

    res.json({
      success: true,
      data: {
        period: { days, startDate },
        summary: {
          totalViews: eventCounts["post_view"] ?? 0,
          faqClicks: eventCounts["faq_click"] ?? 0,
          tocClicks: eventCounts["toc_click"] ?? 0,
          shareFacebook: eventCounts["share_facebook"] ?? 0,
          shareTwitter: eventCounts["share_twitter"] ?? 0,
          shareCopyLink: eventCounts["share_copy_link"] ?? 0,
          tagClicks: eventCounts["tag_click"] ?? 0,
          relatedPostClicks: eventCounts["related_post_click"] ?? 0,
        },
        eventCounts,
        dailyStats,
      },
    });
  }

  async getOverview(req: Request, res: Response): Promise<void> {
    const days = parseInt(req.query.days as string) || 30;
    const overview = await postAnalyticsRepo.getOverview(days);
    res.json({ success: true, data: { period: { days }, ...overview } });
  }

  async getDailyStats(req: Request, res: Response): Promise<void> {
    const { entityType, entityId } = req.params;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;

    const stats = await postAnalyticsRepo.getDailyStats(entityId, entityType, startDate);
    res.json(stats);
  }
}

export const postAnalyticsController = new PostAnalyticsController();
