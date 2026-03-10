/**
 * Post Tag Controller
 * Handles HTTP requests for tag management
 */

import type { Request, Response } from "express";
import * as postTagsRepo from "../db/models/post-tags";

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

class PostTagController {
  async list(req: Request, res: Response): Promise<void> {
    const search = req.query.search as string | undefined;
    const isActive =
      req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;

    const tags = await postTagsRepo.listTags({ search, isActive });
    res.json(tags);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const tag = await postTagsRepo.getTagById(id);
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.json(tag);
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    const tag = await postTagsRepo.getTagBySlug(slug);
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.json(tag);
  }

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.name || body.name.trim() === "") {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    let slug = body.slug || slugify(body.name);
    const exists = await postTagsRepo.slugExists(slug);
    if (exists) {
      slug = `${slug}-${Date.now()}`;
    }

    const tag = await postTagsRepo.createTag({
      name: body.name,
      slug,
      description: body.description ?? null,
      color: body.color ?? null,
      is_active: body.isActive ?? body.is_active ?? true,
    });

    res.status(201).json(tag);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;

    const existing = await postTagsRepo.getTagById(id);
    if (!existing) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) {
      const conflict = await postTagsRepo.slugExists(body.slug, id);
      if (conflict) {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }
      updateData.slug = body.slug;
    }
    if (body.description !== undefined) updateData.description = body.description;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.isActive !== undefined || body.is_active !== undefined)
      updateData.is_active = body.isActive ?? body.is_active;

    const tag = await postTagsRepo.updateTag(id, updateData);
    res.json(tag);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await postTagsRepo.deleteTag(id);
    if (!deleted) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.json({ message: "Tag deleted successfully" });
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const tag = await postTagsRepo.toggleActive(id);
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.json(tag);
  }

  async generateSlug(req: Request, res: Response): Promise<void> {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    const slug = slugify(name);
    res.json({ slug });
  }
}

export const postTagController = new PostTagController();
