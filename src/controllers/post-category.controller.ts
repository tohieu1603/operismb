/**
 * Post Category Controller
 * Handles HTTP requests for category management
 */

import type { Request, Response } from "express";
import * as postCategoriesRepo from "../db/models/post-categories";

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

class PostCategoryController {
  async list(req: Request, res: Response): Promise<void> {
    const search = req.query.search as string | undefined;
    const parentId = req.query.parentId as string | undefined;
    const isActive =
      req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    const sortBy = (req.query.sortBy as string) || "sort_order";
    const sortOrder = (req.query.sortOrder as "ASC" | "DESC") || "ASC";

    const categories = await postCategoriesRepo.listCategories({
      search,
      parentId,
      isActive,
      sortBy,
      sortOrder,
    });
    res.json(categories);
  }

  async getTree(_req: Request, res: Response): Promise<void> {
    const tree = await postCategoriesRepo.getCategoryTree();
    res.json(tree);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const category = await postCategoriesRepo.getCategoryById(id);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(category);
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    const category = await postCategoriesRepo.getCategoryBySlug(slug);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(category);
  }

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.name || body.name.trim() === "") {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    let slug = body.slug || slugify(body.name);
    const exists = await postCategoriesRepo.slugExists(slug);
    if (exists) {
      slug = `${slug}-${Date.now()}`;
    }

    const category = await postCategoriesRepo.createCategory({
      name: body.name,
      slug,
      description: body.description ?? null,
      parent_id: body.parentId ?? body.parent_id ?? null,
      sort_order: body.sortOrder ?? body.sort_order ?? 0,
      is_active: body.isActive ?? body.is_active ?? true,
      seo_title: body.seoTitle ?? body.seo_title ?? null,
      seo_description: body.seoDescription ?? body.seo_description ?? null,
      og_image: body.ogImage ?? body.og_image ?? null,
      path: body.path ?? null,
      level: body.level ?? 0,
    });

    res.status(201).json(category);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;

    const existing = await postCategoriesRepo.getCategoryById(id);
    if (!existing) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) {
      const conflict = await postCategoriesRepo.slugExists(body.slug, id);
      if (conflict) {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }
      updateData.slug = body.slug;
    }
    if (body.description !== undefined) updateData.description = body.description;
    if (body.parentId !== undefined || body.parent_id !== undefined)
      updateData.parent_id = body.parentId ?? body.parent_id;
    if (body.sortOrder !== undefined || body.sort_order !== undefined)
      updateData.sort_order = body.sortOrder ?? body.sort_order;
    if (body.isActive !== undefined || body.is_active !== undefined)
      updateData.is_active = body.isActive ?? body.is_active;
    if (body.seoTitle !== undefined || body.seo_title !== undefined)
      updateData.seo_title = body.seoTitle ?? body.seo_title;
    if (body.seoDescription !== undefined || body.seo_description !== undefined)
      updateData.seo_description = body.seoDescription ?? body.seo_description;
    if (body.ogImage !== undefined || body.og_image !== undefined)
      updateData.og_image = body.ogImage ?? body.og_image;
    if (body.path !== undefined) updateData.path = body.path;
    if (body.level !== undefined) updateData.level = body.level;

    const category = await postCategoriesRepo.updateCategory(id, updateData);
    res.json(category);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const hasChildren = await postCategoriesRepo.hasChildren(id);
    if (hasChildren) {
      res.status(400).json({ error: "Cannot delete category with subcategories" });
      return;
    }

    const deleted = await postCategoriesRepo.deleteCategory(id);
    if (!deleted) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json({ message: "Category deleted successfully" });
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const category = await postCategoriesRepo.toggleActive(id);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(category);
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

export const postCategoryController = new PostCategoryController();
