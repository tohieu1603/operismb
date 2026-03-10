/**
 * Dictionary Controller
 * Handles HTTP requests for dictionary/glossary management
 */

import type { Request, Response } from "express";
import * as dictionariesRepo from "../db/models/dictionaries";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

class DictionaryController {
  async list(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const letter = req.query.letter as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const tags = req.query.tags ? (req.query.tags as string).split(",") : undefined;
    const isActive =
      req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    const isFeatured =
      req.query.isFeatured === "true" ? true : req.query.isFeatured === "false" ? false : undefined;
    const sortBy = (req.query.sortBy as string) || "term";
    const sortOrder = (req.query.sortOrder as "ASC" | "DESC") || "ASC";

    const result = await dictionariesRepo.listDictionary({
      page,
      limit,
      search,
      letter,
      categoryId,
      tags,
      isActive,
      isFeatured,
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

  async getAlphabetIndex(req: Request, res: Response): Promise<void> {
    const isActive = req.query.isActive !== "false";
    const result = await dictionariesRepo.getAlphabetIndex(isActive);
    res.json(result);
  }

  async getFeatured(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await dictionariesRepo.getFeaturedTerms(limit);
    res.json(result);
  }

  async getPopular(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await dictionariesRepo.getPopularTerms(limit);
    res.json(result);
  }

  async getRecent(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await dictionariesRepo.getRecentTerms(limit);
    res.json(result);
  }

  async getSuggestions(req: Request, res: Response): Promise<void> {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      res.json([]);
      return;
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await dictionariesRepo.getSuggestions(query, limit);
    res.json(result);
  }

  async getByLetter(req: Request, res: Response): Promise<void> {
    const { letter } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;

    const result = await dictionariesRepo.listDictionary({
      letter: letter.toUpperCase(),
      isActive: true,
      page,
      limit,
      sortBy: "term",
      sortOrder: "ASC",
    });
    res.json(result);
  }

  async getByCategory(req: Request, res: Response): Promise<void> {
    const { categoryId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await dictionariesRepo.getTermsByCategory(categoryId, limit);
    res.json(result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const term = await dictionariesRepo.getDictionaryById(id);
    if (!term) {
      res.status(404).json({ error: "Dictionary term not found" });
      return;
    }
    res.json(term);
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    const term = await dictionariesRepo.getDictionaryBySlug(slug);
    if (!term) {
      res.status(404).json({ error: "Dictionary term not found" });
      return;
    }
    // Increment view count for public view
    await dictionariesRepo.incrementViewCount(term.id);
    res.json(term);
  }

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;

    if (!body.term || body.term.trim() === "") {
      res.status(400).json({ error: "Term is required" });
      return;
    }
    if (!body.definition || body.definition.trim() === "") {
      res.status(400).json({ error: "Definition is required" });
      return;
    }

    let slug = body.slug || slugify(body.term);
    const slugConflict = await dictionariesRepo.slugExists(slug);
    if (slugConflict) {
      slug = `${slug}-${Date.now()}`;
    }

    const term = await dictionariesRepo.createDictionary({
      term: body.term,
      slug,
      definition: body.definition,
      description: body.description ?? null,
      synonym: body.synonym ?? null,
      related_terms: body.relatedTerms ?? body.related_terms ?? null,
      examples: body.examples ?? null,
      category_id: body.categoryId ?? body.category_id ?? null,
      tags: body.tags ?? null,
      source: body.source ?? null,
      image_url: body.imageUrl ?? body.image_url ?? null,
      audio_url: body.audioUrl ?? body.audio_url ?? null,
      video_url: body.videoUrl ?? body.video_url ?? null,
      is_active: body.isActive ?? body.is_active ?? true,
      is_featured: body.isFeatured ?? body.is_featured ?? false,
      sort_order: body.sortOrder ?? body.sort_order ?? 0,
      seo: body.seo ?? null,
      created_by: userId ?? null,
    });

    res.status(201).json(term);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;

    const existing = await dictionariesRepo.getDictionaryById(id);
    if (!existing) {
      res.status(404).json({ error: "Dictionary term not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};

    if (body.term !== undefined) updateData.term = body.term;
    if (body.slug !== undefined) {
      const conflict = await dictionariesRepo.slugExists(body.slug, id);
      if (conflict) {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }
      updateData.slug = body.slug;
    }
    if (body.definition !== undefined) updateData.definition = body.definition;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.synonym !== undefined) updateData.synonym = body.synonym;
    if (body.relatedTerms !== undefined || body.related_terms !== undefined)
      updateData.related_terms = body.relatedTerms ?? body.related_terms;
    if (body.examples !== undefined) updateData.examples = body.examples;
    if (body.categoryId !== undefined || body.category_id !== undefined)
      updateData.category_id = body.categoryId ?? body.category_id;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.imageUrl !== undefined || body.image_url !== undefined)
      updateData.image_url = body.imageUrl ?? body.image_url;
    if (body.audioUrl !== undefined || body.audio_url !== undefined)
      updateData.audio_url = body.audioUrl ?? body.audio_url;
    if (body.videoUrl !== undefined || body.video_url !== undefined)
      updateData.video_url = body.videoUrl ?? body.video_url;
    if (body.isActive !== undefined || body.is_active !== undefined)
      updateData.is_active = body.isActive ?? body.is_active;
    if (body.isFeatured !== undefined || body.is_featured !== undefined)
      updateData.is_featured = body.isFeatured ?? body.is_featured;
    if (body.sortOrder !== undefined || body.sort_order !== undefined)
      updateData.sort_order = body.sortOrder ?? body.sort_order;
    if (body.seo !== undefined) updateData.seo = body.seo;
    if (userId) updateData.updated_by = userId;

    const term = await dictionariesRepo.updateDictionary(id, updateData);
    res.json(term);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await dictionariesRepo.deleteDictionary(id);
    if (!deleted) {
      res.status(404).json({ error: "Dictionary term not found" });
      return;
    }
    res.json({ success: true, message: "Dictionary term deleted successfully" });
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const term = await dictionariesRepo.toggleActive(id);
    if (!term) {
      res.status(404).json({ error: "Dictionary term not found" });
      return;
    }
    res.json(term);
  }

  async toggleFeatured(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const term = await dictionariesRepo.toggleFeatured(id);
    if (!term) {
      res.status(404).json({ error: "Dictionary term not found" });
      return;
    }
    res.json(term);
  }

  async trackView(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    await dictionariesRepo.incrementViewCount(id);
    res.json({ success: true });
  }

  async bulkImport(req: Request, res: Response): Promise<void> {
    const { terms } = req.body;
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;

    if (!Array.isArray(terms) || terms.length === 0) {
      res.status(400).json({ error: "Terms array is required" });
      return;
    }
    if (terms.length > 100) {
      res.status(400).json({ error: "Maximum 100 terms per import" });
      return;
    }

    // Attach userId to each term
    const termsWithUser = terms.map((t) => ({ ...t, created_by: userId ?? null }));
    const result = await dictionariesRepo.bulkImport(termsWithUser);
    res.json(result);
  }
}

export const dictionaryController = new DictionaryController();
