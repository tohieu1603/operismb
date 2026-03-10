/**
 * Post Author Controller
 * Handles HTTP requests for author management
 */

import type { Request, Response } from "express";
import * as postAuthorsRepo from "../db/models/post-authors";

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

class PostAuthorController {
  async list(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const isActive =
      req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    const isFeatured =
      req.query.isFeatured === "true" ? true : req.query.isFeatured === "false" ? false : undefined;
    const expertise = req.query.expertise as string | undefined;
    const sortBy = (req.query.sortBy as string) || "sort_order";
    const sortOrder = (req.query.sortOrder as "ASC" | "DESC") || "ASC";

    const result = await postAuthorsRepo.listAuthors({
      page,
      limit,
      search,
      isActive,
      isFeatured,
      expertise,
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

  async getDropdown(_req: Request, res: Response): Promise<void> {
    const authors = await postAuthorsRepo.getActiveAuthors();
    res.json(authors);
  }

  async getFeatured(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string) || 10;
    const authors = await postAuthorsRepo.getFeaturedAuthors(limit);
    res.json(authors);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const author = await postAuthorsRepo.getAuthorById(id);
    if (!author) {
      res.status(404).json({ error: "Author not found" });
      return;
    }
    res.json(author);
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    const author = await postAuthorsRepo.getAuthorBySlug(slug);
    if (!author) {
      res.status(404).json({ error: "Author not found" });
      return;
    }
    res.json(author);
  }

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.name || body.name.trim() === "") {
      res.status(400).json({ error: "Author name is required" });
      return;
    }

    let slug = body.slug || slugify(body.name);
    const exists = await postAuthorsRepo.slugExists(slug);
    if (exists) {
      slug = `${slug}-${Date.now()}`;
    }

    const author = await postAuthorsRepo.createAuthor({
      name: body.name,
      slug,
      email: body.email ?? null,
      avatar_url: body.avatarUrl ?? body.avatar_url ?? null,
      bio: body.bio ?? null,
      short_bio: body.shortBio ?? body.short_bio ?? null,
      job_title: body.jobTitle ?? body.job_title ?? null,
      company: body.company ?? null,
      location: body.location ?? null,
      expertise: body.expertise ?? [],
      experience: body.experience ?? [],
      education: body.education ?? [],
      certifications: body.certifications ?? [],
      achievements: body.achievements ?? [],
      skills: body.skills ?? [],
      publications: body.publications ?? [],
      articles: body.articles ?? [],
      credentials: body.credentials ?? null,
      years_experience: body.yearsExperience ?? body.years_experience ?? null,
      website: body.website ?? null,
      twitter: body.twitter ?? null,
      linkedin: body.linkedin ?? null,
      facebook: body.facebook ?? null,
      github: body.github ?? null,
      youtube: body.youtube ?? null,
      same_as: body.sameAs ?? body.same_as ?? [],
      user_id: body.userId ?? body.user_id ?? null,
      meta_title: body.metaTitle ?? body.meta_title ?? null,
      meta_description: body.metaDescription ?? body.meta_description ?? null,
      is_active: body.isActive ?? body.is_active ?? true,
      is_featured: body.isFeatured ?? body.is_featured ?? false,
      sort_order: body.sortOrder ?? body.sort_order ?? 0,
    });

    res.status(201).json(author);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;

    const existing = await postAuthorsRepo.getAuthorById(id);
    if (!existing) {
      res.status(404).json({ error: "Author not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) {
      const conflict = await postAuthorsRepo.slugExists(body.slug, id);
      if (conflict) {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }
      updateData.slug = body.slug;
    }
    if (body.email !== undefined) updateData.email = body.email;
    if (body.avatarUrl !== undefined || body.avatar_url !== undefined)
      updateData.avatar_url = body.avatarUrl ?? body.avatar_url;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.shortBio !== undefined || body.short_bio !== undefined)
      updateData.short_bio = body.shortBio ?? body.short_bio;
    if (body.jobTitle !== undefined || body.job_title !== undefined)
      updateData.job_title = body.jobTitle ?? body.job_title;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.expertise !== undefined) updateData.expertise = body.expertise;
    if (body.experience !== undefined) updateData.experience = body.experience;
    if (body.education !== undefined) updateData.education = body.education;
    if (body.certifications !== undefined) updateData.certifications = body.certifications;
    if (body.achievements !== undefined) updateData.achievements = body.achievements;
    if (body.skills !== undefined) updateData.skills = body.skills;
    if (body.publications !== undefined) updateData.publications = body.publications;
    if (body.articles !== undefined) updateData.articles = body.articles;
    if (body.credentials !== undefined) updateData.credentials = body.credentials;
    if (body.yearsExperience !== undefined || body.years_experience !== undefined)
      updateData.years_experience = body.yearsExperience ?? body.years_experience;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.twitter !== undefined) updateData.twitter = body.twitter;
    if (body.linkedin !== undefined) updateData.linkedin = body.linkedin;
    if (body.facebook !== undefined) updateData.facebook = body.facebook;
    if (body.github !== undefined) updateData.github = body.github;
    if (body.youtube !== undefined) updateData.youtube = body.youtube;
    if (body.sameAs !== undefined || body.same_as !== undefined)
      updateData.same_as = body.sameAs ?? body.same_as;
    if (body.userId !== undefined || body.user_id !== undefined)
      updateData.user_id = body.userId ?? body.user_id;
    if (body.metaTitle !== undefined || body.meta_title !== undefined)
      updateData.meta_title = body.metaTitle ?? body.meta_title;
    if (body.metaDescription !== undefined || body.meta_description !== undefined)
      updateData.meta_description = body.metaDescription ?? body.meta_description;
    if (body.isActive !== undefined || body.is_active !== undefined)
      updateData.is_active = body.isActive ?? body.is_active;
    if (body.isFeatured !== undefined || body.is_featured !== undefined)
      updateData.is_featured = body.isFeatured ?? body.is_featured;
    if (body.sortOrder !== undefined || body.sort_order !== undefined)
      updateData.sort_order = body.sortOrder ?? body.sort_order;

    const author = await postAuthorsRepo.updateAuthor(id, updateData);
    res.json(author);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await postAuthorsRepo.deleteAuthor(id);
    if (!deleted) {
      res.status(404).json({ error: "Author not found" });
      return;
    }
    res.json({ message: "Author deleted successfully" });
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const author = await postAuthorsRepo.toggleActive(id);
    if (!author) {
      res.status(404).json({ error: "Author not found" });
      return;
    }
    res.json(author);
  }

  async toggleFeatured(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const author = await postAuthorsRepo.toggleFeatured(id);
    if (!author) {
      res.status(404).json({ error: "Author not found" });
      return;
    }
    res.json(author);
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

  async updateSortOrder(req: Request, res: Response): Promise<void> {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "Items must be an array" });
      return;
    }
    await postAuthorsRepo.bulkUpdateSortOrder(items);
    res.json({ message: "Sort order updated successfully" });
  }
}

export const postAuthorController = new PostAuthorController();
