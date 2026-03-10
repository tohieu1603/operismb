/**
 * Keyword Controller
 * Handles HTTP requests for keyword tracking management
 */

import type { Request, Response } from "express";
import * as keywordsRepo from "../db/models/keywords";

class KeywordController {
  async list(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const postId = req.query.postId as string | undefined;
    const isTracking =
      req.query.isTracking === "true" ? true : req.query.isTracking === "false" ? false : undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "ASC" | "DESC") || "DESC";

    const result = await keywordsRepo.listKeywords({
      page,
      limit,
      search,
      postId,
      isTracking,
      sortBy,
      sortOrder,
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

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const keyword = await keywordsRepo.getKeywordById(id);
    if (!keyword) {
      res.status(404).json({ error: "Keyword not found" });
      return;
    }
    res.json(keyword);
  }

  async getByPost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const keywords = await keywordsRepo.getKeywordsByPost(postId);
    res.json(keywords);
  }

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.keyword || body.keyword.trim() === "") {
      res.status(400).json({ error: "Keyword is required" });
      return;
    }

    const keyword = await keywordsRepo.createKeyword({
      keyword: body.keyword,
      language: body.language ?? null,
      country: body.country ?? null,
      search_volume: body.searchVolume ?? body.search_volume ?? null,
      difficulty: body.difficulty ?? null,
      current_rank: body.currentRank ?? body.current_rank ?? null,
      target_url: body.targetUrl ?? body.target_url ?? null,
      post_id: body.postId ?? body.post_id ?? null,
      is_tracking: body.isTracking ?? body.is_tracking ?? true,
    });

    res.status(201).json(keyword);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;

    const existing = await keywordsRepo.getKeywordById(id);
    if (!existing) {
      res.status(404).json({ error: "Keyword not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};

    if (body.keyword !== undefined) updateData.keyword = body.keyword;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.searchVolume !== undefined || body.search_volume !== undefined)
      updateData.search_volume = body.searchVolume ?? body.search_volume;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.currentRank !== undefined || body.current_rank !== undefined)
      updateData.current_rank = body.currentRank ?? body.current_rank;
    if (body.previousRank !== undefined || body.previous_rank !== undefined)
      updateData.previous_rank = body.previousRank ?? body.previous_rank;
    if (body.bestRank !== undefined || body.best_rank !== undefined)
      updateData.best_rank = body.bestRank ?? body.best_rank;
    if (body.currentPosition !== undefined || body.current_position !== undefined)
      updateData.current_position = body.currentPosition ?? body.current_position;
    if (body.previousPosition !== undefined || body.previous_position !== undefined)
      updateData.previous_position = body.previousPosition ?? body.previous_position;
    if (body.positionChange !== undefined || body.position_change !== undefined)
      updateData.position_change = body.positionChange ?? body.position_change;
    if (body.targetUrl !== undefined || body.target_url !== undefined)
      updateData.target_url = body.targetUrl ?? body.target_url;
    if (body.postId !== undefined || body.post_id !== undefined)
      updateData.post_id = body.postId ?? body.post_id;
    if (body.clicks !== undefined) updateData.clicks = body.clicks;
    if (body.impressions !== undefined) updateData.impressions = body.impressions;
    if (body.ctr !== undefined) updateData.ctr = body.ctr;
    if (body.isTracking !== undefined || body.is_tracking !== undefined)
      updateData.is_tracking = body.isTracking ?? body.is_tracking;
    if (body.rankingHistory !== undefined || body.ranking_history !== undefined)
      updateData.ranking_history = body.rankingHistory ?? body.ranking_history;
    if (body.lastChecked !== undefined || body.last_checked !== undefined)
      updateData.last_checked = body.lastChecked ?? body.last_checked;

    const keyword = await keywordsRepo.updateKeyword(id, updateData);
    res.json(keyword);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await keywordsRepo.deleteKeyword(id);
    if (!deleted) {
      res.status(404).json({ error: "Keyword not found" });
      return;
    }
    res.json({ message: "Keyword deleted successfully" });
  }

  async bulkCreate(req: Request, res: Response): Promise<void> {
    const { keywords } = req.body;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      res.status(400).json({ error: "keywords array is required" });
      return;
    }
    const created = await keywordsRepo.bulkCreateKeywords(keywords);
    res.status(201).json(created);
  }
}

export const keywordController = new KeywordController();
