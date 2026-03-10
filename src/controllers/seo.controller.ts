/**
 * SEO Controller
 * Combines SEO scores + SEO logs management
 */

import type { Request, Response } from "express";
import * as seoScoresRepo from "../db/models/seo-scores";
import * as seoLogsRepo from "../db/models/seo-logs";
import { SeoLogAction, SeoLogEntityType, SeoLogStatus } from "../db/entities/seo-log.entity";

class SeoController {
  // ========== SEO Scores ==========

  async listScores(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const postId = req.query.postId as string | undefined;
    const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : undefined;

    const result = await seoScoresRepo.listScores({ page, limit, postId, minScore });

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

  async getScoreById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const score = await seoScoresRepo.getScoreById(id);
    if (!score) {
      res.status(404).json({ error: "SEO score not found" });
      return;
    }
    res.json(score);
  }

  async getScoreByPost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const score = await seoScoresRepo.getLatestScoreByPost(postId);
    if (!score) {
      res.status(404).json({ error: "No SEO score found for this post" });
      return;
    }
    res.json(score);
  }

  async getScoreHistoryByPost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const scores = await seoScoresRepo.getScoreHistoryByPost(postId, limit);
    res.json(scores);
  }

  async createScore(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.postId && !body.post_id) {
      res.status(400).json({ error: "postId is required" });
      return;
    }

    const score = await seoScoresRepo.createSeoScore({
      post_id: body.postId ?? body.post_id,
      overall_score: body.overallScore ?? body.overall_score ?? 0,
      title_score: body.titleScore ?? body.title_score ?? 0,
      meta_description_score: body.metaDescriptionScore ?? body.meta_description_score ?? 0,
      content_score: body.contentScore ?? body.content_score ?? 0,
      heading_score: body.headingScore ?? body.heading_score ?? 0,
      keyword_score: body.keywordScore ?? body.keyword_score ?? 0,
      readability_score: body.readabilityScore ?? body.readability_score ?? 0,
      internal_link_score: body.internalLinkScore ?? body.internal_link_score ?? 0,
      image_score: body.imageScore ?? body.image_score ?? 0,
      technical_score: body.technicalScore ?? body.technical_score ?? 0,
      analysis: body.analysis ?? null,
      suggestions: body.suggestions ?? null,
      ai_suggestions: body.aiSuggestions ?? body.ai_suggestions ?? null,
    });

    res.status(201).json(score);
  }

  async deleteScore(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await seoScoresRepo.deleteSeoScore(id);
    if (!deleted) {
      res.status(404).json({ error: "SEO score not found" });
      return;
    }
    res.json({ message: "SEO score deleted" });
  }

  // ========== SEO Logs ==========

  async listLogs(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const action = req.query.action as SeoLogAction | undefined;
    const entityType = req.query.entityType as SeoLogEntityType | undefined;
    const entityId = req.query.entityId as string | undefined;
    const status = req.query.status as SeoLogStatus | undefined;
    const isScheduled =
      req.query.isScheduled === "true"
        ? true
        : req.query.isScheduled === "false"
        ? false
        : undefined;

    const result = await seoLogsRepo.listSeoLogs({
      page,
      limit,
      action,
      entityType,
      entityId,
      status,
      isScheduled,
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

  async getLogById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const log = await seoLogsRepo.getSeoLogById(id);
    if (!log) {
      res.status(404).json({ error: "SEO log not found" });
      return;
    }
    res.json(log);
  }

  async getLogsByEntity(req: Request, res: Response): Promise<void> {
    const { entityType, entityId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await seoLogsRepo.getSeoLogsByEntity(
      entityType as SeoLogEntityType,
      entityId,
      limit
    );
    res.json(logs);
  }

  async createLog(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.action) {
      res.status(400).json({ error: "action is required" });
      return;
    }

    const log = await seoLogsRepo.createSeoLog({
      action: body.action,
      entity_type: body.entityType ?? body.entity_type ?? null,
      entity_id: body.entityId ?? body.entity_id ?? null,
      entity_url: body.entityUrl ?? body.entity_url ?? null,
      status: body.status ?? "pending",
      message: body.message ?? null,
      details: body.details ?? null,
      api_response: body.apiResponse ?? body.api_response ?? null,
      duration: body.duration ?? null,
      user_id: body.userId ?? body.user_id ?? null,
      is_scheduled: body.isScheduled ?? body.is_scheduled ?? false,
    });

    res.status(201).json(log);
  }

  async deleteLog(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await seoLogsRepo.deleteSeoLog(id);
    if (!deleted) {
      res.status(404).json({ error: "SEO log not found" });
      return;
    }
    res.json({ message: "SEO log deleted" });
  }

  async pruneLogs(req: Request, res: Response): Promise<void> {
    const daysOld = parseInt(req.query.daysOld as string) || 90;
    const count = await seoLogsRepo.pruneLogs(daysOld);
    res.json({ message: `Pruned ${count} old SEO logs` });
  }
}

export const seoController = new SeoController();
