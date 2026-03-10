/**
 * Post Controller
 * Handles HTTP requests for post management
 * Authorization: admin sees all posts, public sees only published
 */

import type { Request, Response } from "express";
import * as postsRepo from "../db/models/posts";
import * as postCategoriesRepo from "../db/models/post-categories";
import { PostStatus } from "../db/entities/post.entity";

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

function isAdmin(req: Request): boolean {
  return req.user?.role === "admin";
}

class PostController {
  async list(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const search = req.query.search as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const authorId = req.query.authorId as string | undefined;
    const tagId = req.query.tagId as string | undefined;
    const isFeatured =
      req.query.isFeatured === "true" ? true : req.query.isFeatured === "false" ? false : undefined;
    const isTrending =
      req.query.isTrending === "true" ? true : req.query.isTrending === "false" ? false : undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "ASC" | "DESC") || "DESC";

    // Admin can filter by any status; public always sees published only
    const status: PostStatus | undefined = isAdmin(req)
      ? (req.query.status as PostStatus | undefined)
      : "published";

    const result = await postsRepo.listPosts({
      page,
      limit,
      search,
      categoryId,
      authorId,
      tagId,
      status,
      isFeatured,
      isTrending,
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
    const post = await postsRepo.getPostById(id);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Non-admin can only see published posts
    if (!isAdmin(req) && post.status !== "published") {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(post);
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    const post = await postsRepo.getPostBySlug(slug);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Non-admin can only see published posts
    if (!isAdmin(req) && post.status !== "published") {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Increment view count for public access
    await postsRepo.incrementViewCount(post.id);
    res.json(post);
  }

  async getRecent(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string) || 5;
    // getRecentPosts already filters by status = 'published'
    const posts = await postsRepo.getRecentPosts(limit);
    res.json(posts);
  }

  async getStatistics(_req: Request, res: Response): Promise<void> {
    // Admin-only (enforced by route middleware)
    const byStatus = await postsRepo.countByStatus();
    const total = Object.values(byStatus).reduce((sum, c) => sum + c, 0);
    res.json({ total, byStatus });
  }

  async getByCategory(req: Request, res: Response): Promise<void> {
    const { categoryId } = req.params;
    const limit = parseInt(req.query.limit as string) || undefined;
    // getPostsByCategory already filters by status = 'published'
    const posts = await postsRepo.getPostsByCategory(categoryId, limit);
    res.json(posts);
  }

  async getByCategorySlug(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const category = await postCategoriesRepo.getCategoryBySlug(slug);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const result = await postsRepo.listPosts({
      page,
      limit,
      categoryId: category.id,
      status: "published",
      sortBy: "createdAt",
      sortOrder: "DESC",
    });

    res.json({
      data: result.data,
      category,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  }

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.title || body.title.trim() === "") {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    if (!body.content || body.content.trim() === "") {
      res.status(400).json({ error: "Content is required" });
      return;
    }
    if (!body.categoryId && !body.category_id) {
      res.status(400).json({ error: "Category is required" });
      return;
    }

    const categoryId = body.categoryId || body.category_id;

    // Auto-generate slug from title if not provided
    let slug = body.slug || slugify(body.title);
    const exists = await postsRepo.slugExists(slug);
    if (exists) {
      slug = `${slug}-${Date.now()}`;
    }

    const post = await postsRepo.createPost({
      title: body.title,
      subtitle: body.subtitle ?? null,
      slug,
      excerpt: body.excerpt ?? null,
      content: body.content,
      cover_image: body.coverImage ?? body.cover_image ?? null,
      category_id: categoryId,
      status: body.status ?? "draft",
      author: body.author ?? null,
      author_id: body.authorId ?? body.author_id ?? null,
      tags: body.tags ?? null,
      tags_relation: body.tagsRelation ?? body.tags_relation ?? [],
      meta_title: body.metaTitle ?? body.meta_title ?? null,
      meta_description: body.metaDescription ?? body.meta_description ?? null,
      meta_keywords: body.metaKeywords ?? body.meta_keywords ?? null,
      canonical_url: body.canonicalUrl ?? body.canonical_url ?? null,
      og_title: body.ogTitle ?? body.og_title ?? null,
      og_description: body.ogDescription ?? body.og_description ?? null,
      og_image: body.ogImage ?? body.og_image ?? null,
      twitter_title: body.twitterTitle ?? body.twitter_title ?? null,
      twitter_description: body.twitterDescription ?? body.twitter_description ?? null,
      twitter_image: body.twitterImage ?? body.twitter_image ?? null,
      robots: body.robots ?? "index,follow",
      news_keywords: body.newsKeywords ?? body.news_keywords ?? null,
      is_evergreen: body.isEvergreen ?? body.is_evergreen ?? false,
      is_featured: body.isFeatured ?? body.is_featured ?? false,
      allow_comments: body.allowComments ?? body.allow_comments ?? true,
      reading_time: body.readingTime ?? body.reading_time ?? null,
      template: body.template ?? null,
      custom_fields: body.customFields ?? body.custom_fields ?? null,
      is_trending: body.isTrending ?? body.is_trending ?? false,
      faq: body.faq ?? null,
      content_structure: body.contentStructure ?? body.content_structure ?? null,
      content_blocks: body.contentBlocks ?? body.content_blocks ?? null,
    });

    res.status(201).json(post);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;

    const existing = await postsRepo.getPostById(id);
    if (!existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
    if (body.slug !== undefined) {
      const slugConflict = await postsRepo.slugExists(body.slug, id);
      if (slugConflict) {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }
      updateData.slug = body.slug;
    }
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.coverImage !== undefined || body.cover_image !== undefined)
      updateData.cover_image = body.coverImage ?? body.cover_image;
    if (body.categoryId !== undefined || body.category_id !== undefined)
      updateData.category_id = body.categoryId ?? body.category_id;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.author !== undefined) updateData.author = body.author;
    if (body.authorId !== undefined || body.author_id !== undefined)
      updateData.author_id = body.authorId ?? body.author_id;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.tagsRelation !== undefined || body.tags_relation !== undefined)
      updateData.tags_relation = body.tagsRelation ?? body.tags_relation;
    if (body.metaTitle !== undefined || body.meta_title !== undefined)
      updateData.meta_title = body.metaTitle ?? body.meta_title;
    if (body.metaDescription !== undefined || body.meta_description !== undefined)
      updateData.meta_description = body.metaDescription ?? body.meta_description;
    if (body.metaKeywords !== undefined || body.meta_keywords !== undefined)
      updateData.meta_keywords = body.metaKeywords ?? body.meta_keywords;
    if (body.canonicalUrl !== undefined || body.canonical_url !== undefined)
      updateData.canonical_url = body.canonicalUrl ?? body.canonical_url;
    if (body.ogTitle !== undefined || body.og_title !== undefined)
      updateData.og_title = body.ogTitle ?? body.og_title;
    if (body.ogDescription !== undefined || body.og_description !== undefined)
      updateData.og_description = body.ogDescription ?? body.og_description;
    if (body.ogImage !== undefined || body.og_image !== undefined)
      updateData.og_image = body.ogImage ?? body.og_image;
    if (body.twitterTitle !== undefined || body.twitter_title !== undefined)
      updateData.twitter_title = body.twitterTitle ?? body.twitter_title;
    if (body.twitterDescription !== undefined || body.twitter_description !== undefined)
      updateData.twitter_description = body.twitterDescription ?? body.twitter_description;
    if (body.twitterImage !== undefined || body.twitter_image !== undefined)
      updateData.twitter_image = body.twitterImage ?? body.twitter_image;
    if (body.robots !== undefined) updateData.robots = body.robots;
    if (body.newsKeywords !== undefined || body.news_keywords !== undefined)
      updateData.news_keywords = body.newsKeywords ?? body.news_keywords;
    if (body.isEvergreen !== undefined || body.is_evergreen !== undefined)
      updateData.is_evergreen = body.isEvergreen ?? body.is_evergreen;
    if (body.isFeatured !== undefined || body.is_featured !== undefined)
      updateData.is_featured = body.isFeatured ?? body.is_featured;
    if (body.allowComments !== undefined || body.allow_comments !== undefined)
      updateData.allow_comments = body.allowComments ?? body.allow_comments;
    if (body.readingTime !== undefined || body.reading_time !== undefined)
      updateData.reading_time = body.readingTime ?? body.reading_time;
    if (body.template !== undefined) updateData.template = body.template;
    if (body.customFields !== undefined || body.custom_fields !== undefined)
      updateData.custom_fields = body.customFields ?? body.custom_fields;
    if (body.isTrending !== undefined || body.is_trending !== undefined)
      updateData.is_trending = body.isTrending ?? body.is_trending;
    if (body.trendingRank !== undefined || body.trending_rank !== undefined)
      updateData.trending_rank = body.trendingRank ?? body.trending_rank;
    if (body.faq !== undefined) updateData.faq = body.faq;
    if (body.contentStructure !== undefined || body.content_structure !== undefined)
      updateData.content_structure = body.contentStructure ?? body.content_structure;
    if (body.contentBlocks !== undefined || body.content_blocks !== undefined)
      updateData.content_blocks = body.contentBlocks ?? body.content_blocks;

    const post = await postsRepo.updatePost(id, updateData);
    res.json(post);
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    if (!["draft", "published", "archived"].includes(status)) {
      res.status(400).json({ error: "Invalid status. Must be: draft, published, archived" });
      return;
    }

    const post = await postsRepo.updatePostStatus(id, status as PostStatus);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(post);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await postsRepo.deletePost(id);
    if (!deleted) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json({ message: "Post deleted successfully" });
  }

  async generateSlug(req: Request, res: Response): Promise<void> {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }
    const slug = slugify(title);
    res.json({ slug });
  }

  async incrementViewCount(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    // Only increment for published posts to prevent IDOR enumeration
    const post = await postsRepo.getPostById(id);
    if (!post || post.status !== "published") {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    await postsRepo.incrementViewCount(id);
    res.json({ success: true });
  }
}

export const postController = new PostController();
