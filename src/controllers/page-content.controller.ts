/**
 * Page Content Controller
 * Handles HTTP requests for page content management
 */

import type { Request, Response } from "express";
import * as pageContentsRepo from "../db/models/page-contents";

class PageContentController {
  async list(req: Request, res: Response): Promise<void> {
    const activeOnly = req.query.activeOnly !== "false";
    const pages = await pageContentsRepo.listPageContents(activeOnly);
    res.json(pages);
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const { pageSlug } = req.params;
    const page = await pageContentsRepo.getPageContentBySlug(pageSlug);
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json(page);
  }

  async create(req: Request, res: Response): Promise<void> {
    const { pageSlug, pageName, content, isActive } = req.body;

    if (!pageSlug || !content) {
      res.status(400).json({ error: "pageSlug and content are required" });
      return;
    }

    // Check for duplicate slug
    const exists = await pageContentsRepo.pageSlugExists(pageSlug);
    if (exists) {
      res.status(409).json({ error: "Page with this slug already exists" });
      return;
    }

    const page = await pageContentsRepo.createPageContent({
      page_slug: pageSlug,
      page_name: pageName || pageSlug,
      content,
      is_active: isActive ?? true,
    });

    res.status(201).json(page);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { pageSlug } = req.params;
    const { pageName, content, isActive } = req.body;

    const updateData: Record<string, unknown> = {};
    if (pageName !== undefined) updateData.page_name = pageName;
    if (content !== undefined) updateData.content = content;
    if (isActive !== undefined) updateData.is_active = isActive;

    const page = await pageContentsRepo.updatePageContentBySlug(pageSlug, updateData);
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json(page);
  }

  async upsert(req: Request, res: Response): Promise<void> {
    const { pageSlug } = req.params;
    const { pageName, content, isActive } = req.body;

    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const page = await pageContentsRepo.upsertPageContent(pageSlug, {
      page_name: pageName || pageSlug,
      content,
      is_active: isActive ?? true,
    });

    res.json(page);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { pageSlug } = req.params;
    const deleted = await pageContentsRepo.deletePageContentBySlug(pageSlug);
    if (!deleted) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json({ message: `Page ${pageSlug} deleted successfully` });
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    const { pageSlug } = req.params;
    const page = await pageContentsRepo.toggleActive(pageSlug);
    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    res.json(page);
  }

  async importFromJson(req: Request, res: Response): Promise<void> {
    const { pageSlug, pageName, content } = req.body;

    if (!pageSlug || !content || typeof content !== "object") {
      res.status(400).json({ error: "pageSlug and content object are required" });
      return;
    }

    const page = await pageContentsRepo.upsertPageContent(pageSlug, {
      page_name: pageName || pageSlug,
      content,
      is_active: true,
    });

    res.json({ message: `Page ${pageSlug} imported successfully`, page });
  }
}

export const pageContentController = new PageContentController();
