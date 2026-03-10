/**
 * Posts Repository
 * CRUD operations for posts table
 */

import { AppDataSource } from "../data-source";
import { PostEntity, PostStatus } from "../entities/post.entity";

function getRepo() {
  return AppDataSource.getRepository(PostEntity);
}

export interface PostListOptions {
  page?: number;
  limit?: number;
  offset?: number;
  search?: string;
  categoryId?: string;
  authorId?: string;
  tagId?: string;
  status?: PostStatus;
  isFeatured?: boolean;
  isTrending?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List posts with pagination and filters
 */
export async function listPosts(
  options: PostListOptions = {}
): Promise<{ data: PostEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 10, 100);
  const page = options.page ?? 1;
  const offset = options.offset ?? (page - 1) * limit;
  const sortBy = options.sortBy ?? "created_at";
  const sortOrder = (options.sortOrder ?? "DESC") as "ASC" | "DESC";

  const qb = getRepo()
    .createQueryBuilder("p")
    .leftJoinAndSelect("p.category", "category")
    .leftJoinAndSelect("p.author_info", "author_info");

  if (options.search) {
    qb.andWhere(
      "(p.title ILIKE :search OR p.slug ILIKE :search OR p.excerpt ILIKE :search)",
      { search: `%${options.search}%` }
    );
  }

  if (options.categoryId) {
    qb.andWhere("p.category_id = :categoryId", { categoryId: options.categoryId });
  }

  if (options.authorId) {
    qb.andWhere("p.author_id = :authorId", { authorId: options.authorId });
  }

  if (options.tagId) {
    qb.andWhere(":tagId = ANY(p.tags_relation)", { tagId: options.tagId });
  }

  if (options.status) {
    qb.andWhere("p.status = :status", { status: options.status });
  }

  if (options.isFeatured !== undefined) {
    qb.andWhere("p.is_featured = :isFeatured", { isFeatured: options.isFeatured });
  }

  if (options.isTrending !== undefined) {
    qb.andWhere("p.is_trending = :isTrending", { isTrending: options.isTrending });
  }

  const validSortFields: Record<string, string> = {
    createdAt: "p.created_at",
    updatedAt: "p.updated_at",
    viewCount: "p.view_count",
    title: "p.title",
    publishedAt: "p.published_at",
  };
  const sortField = validSortFields[sortBy] ?? "p.created_at";

  qb.orderBy(sortField, sortOrder).take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get post by ID
 */
export async function getPostById(id: string): Promise<PostEntity | null> {
  return getRepo()
    .createQueryBuilder("p")
    .leftJoinAndSelect("p.category", "category")
    .leftJoinAndSelect("p.author_info", "author_info")
    .where("p.id = :id", { id })
    .getOne();
}

/**
 * Get post by slug
 */
export async function getPostBySlug(slug: string): Promise<PostEntity | null> {
  return getRepo()
    .createQueryBuilder("p")
    .leftJoinAndSelect("p.category", "category")
    .leftJoinAndSelect("p.author_info", "author_info")
    .where("p.slug = :slug", { slug })
    .getOne();
}

/**
 * Check slug exists
 */
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const qb = getRepo().createQueryBuilder("p").where("p.slug = :slug", { slug });
  if (excludeId) {
    qb.andWhere("p.id != :excludeId", { excludeId });
  }
  const count = await qb.getCount();
  return count > 0;
}

/**
 * Create post
 */
export async function createPost(data: Partial<PostEntity>): Promise<PostEntity> {
  const post = getRepo().create(data);
  return getRepo().save(post);
}

/**
 * Update post
 */
export async function updatePost(id: string, data: Partial<PostEntity>): Promise<PostEntity | null> {
  if (Object.keys(data).length === 0) return getPostById(id);
  await getRepo().update({ id }, data as object);
  return getPostById(id);
}

/**
 * Delete post
 */
export async function deletePost(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Update post status
 */
export async function updatePostStatus(id: string, status: PostStatus): Promise<PostEntity | null> {
  const updateData: Partial<PostEntity> = { status };
  if (status === "published") {
    updateData.published_at = new Date();
  }
  await getRepo().update({ id }, updateData as object);
  return getPostById(id);
}

/**
 * Increment view count
 */
export async function incrementViewCount(id: string): Promise<void> {
  await getRepo()
    .createQueryBuilder()
    .update()
    .set({ view_count: () => "view_count + 1" })
    .where("id = :id", { id })
    .execute();
}

/**
 * Get recent published posts
 */
export async function getRecentPosts(limit = 5): Promise<PostEntity[]> {
  return getRepo()
    .createQueryBuilder("p")
    .leftJoinAndSelect("p.category", "category")
    .where("p.status = :status", { status: "published" })
    .orderBy("p.created_at", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Count posts by status
 */
export async function countByStatus(): Promise<Record<string, number>> {
  const results = await getRepo()
    .createQueryBuilder("p")
    .select("p.status", "status")
    .addSelect("COUNT(*)", "count")
    .groupBy("p.status")
    .getRawMany();

  const counts: Record<string, number> = { draft: 0, published: 0, archived: 0 };
  results.forEach((r) => {
    counts[r.status] = parseInt(r.count, 10);
  });
  return counts;
}

/**
 * Get posts by category
 */
export async function getPostsByCategory(categoryId: string, limit?: number): Promise<PostEntity[]> {
  const qb = getRepo()
    .createQueryBuilder("p")
    .where("p.category_id = :categoryId", { categoryId })
    .andWhere("p.status = :status", { status: "published" })
    .orderBy("p.created_at", "DESC");
  if (limit) qb.take(limit);
  return qb.getMany();
}

export default {
  listPosts,
  getPostById,
  getPostBySlug,
  slugExists,
  createPost,
  updatePost,
  deletePost,
  updatePostStatus,
  incrementViewCount,
  getRecentPosts,
  countByStatus,
  getPostsByCategory,
};
