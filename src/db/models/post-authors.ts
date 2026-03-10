/**
 * Post Authors Repository
 * CRUD operations for post_authors table
 */

import { AppDataSource } from "../data-source";
import { PostAuthorEntity } from "../entities/post-author.entity";

function getRepo() {
  return AppDataSource.getRepository(PostAuthorEntity);
}

export interface AuthorListOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  expertise?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List authors with pagination and filters
 */
export async function listAuthors(
  options: AuthorListOptions = {}
): Promise<{ data: PostAuthorEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy ?? "sort_order";
  const sortOrder = (options.sortOrder ?? "ASC") as "ASC" | "DESC";

  const qb = getRepo().createQueryBuilder("a");

  if (options.search) {
    qb.andWhere(
      "(a.name ILIKE :search OR a.slug ILIKE :search OR a.bio ILIKE :search OR a.job_title ILIKE :search OR a.company ILIKE :search)",
      { search: `%${options.search}%` }
    );
  }

  if (options.isActive !== undefined) {
    qb.andWhere("a.is_active = :isActive", { isActive: options.isActive });
  }

  if (options.isFeatured !== undefined) {
    qb.andWhere("a.is_featured = :isFeatured", { isFeatured: options.isFeatured });
  }

  if (options.expertise) {
    qb.andWhere(":expertise = ANY(a.expertise)", { expertise: options.expertise });
  }

  const validSortFields: Record<string, string> = {
    sort_order: "a.sort_order",
    sortOrder: "a.sort_order",
    name: "a.name",
    createdAt: "a.created_at",
  };
  const sortField = validSortFields[sortBy] ?? "a.sort_order";
  qb.orderBy(sortField, sortOrder).take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get active authors for dropdown
 */
export async function getActiveAuthors(): Promise<PostAuthorEntity[]> {
  return getRepo()
    .createQueryBuilder("a")
    .select(["a.id", "a.name", "a.slug", "a.avatar_url", "a.job_title", "a.company", "a.is_active"])
    .where("a.is_active = :isActive", { isActive: true })
    .orderBy("a.sort_order", "ASC")
    .addOrderBy("a.name", "ASC")
    .getMany();
}

/**
 * Get featured authors
 */
export async function getFeaturedAuthors(limit = 10): Promise<PostAuthorEntity[]> {
  return getRepo()
    .createQueryBuilder("a")
    .where("a.is_active = :isActive", { isActive: true })
    .andWhere("a.is_featured = :isFeatured", { isFeatured: true })
    .orderBy("a.sort_order", "ASC")
    .addOrderBy("a.name", "ASC")
    .take(limit)
    .getMany();
}

/**
 * Get author by ID
 */
export async function getAuthorById(id: string): Promise<PostAuthorEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get author by slug
 */
export async function getAuthorBySlug(slug: string): Promise<PostAuthorEntity | null> {
  return getRepo().findOneBy({ slug });
}

/**
 * Check slug exists
 */
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const qb = getRepo().createQueryBuilder("a").where("a.slug = :slug", { slug });
  if (excludeId) qb.andWhere("a.id != :excludeId", { excludeId });
  return (await qb.getCount()) > 0;
}

/**
 * Check email exists
 */
export async function emailExists(email: string, excludeId?: string): Promise<boolean> {
  const qb = getRepo().createQueryBuilder("a").where("a.email = :email", { email });
  if (excludeId) qb.andWhere("a.id != :excludeId", { excludeId });
  return (await qb.getCount()) > 0;
}

/**
 * Create author
 */
export async function createAuthor(data: Partial<PostAuthorEntity>): Promise<PostAuthorEntity> {
  const author = getRepo().create(data);
  return getRepo().save(author);
}

/**
 * Update author
 */
export async function updateAuthor(
  id: string,
  data: Partial<PostAuthorEntity>
): Promise<PostAuthorEntity | null> {
  if (Object.keys(data).length === 0) return getAuthorById(id);
  await getRepo().update({ id }, data as object);
  return getAuthorById(id);
}

/**
 * Delete author
 */
export async function deleteAuthor(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Toggle active
 */
export async function toggleActive(id: string): Promise<PostAuthorEntity | null> {
  const author = await getAuthorById(id);
  if (!author) return null;
  await getRepo().update({ id }, { is_active: !author.is_active });
  return getAuthorById(id);
}

/**
 * Toggle featured
 */
export async function toggleFeatured(id: string): Promise<PostAuthorEntity | null> {
  const author = await getAuthorById(id);
  if (!author) return null;
  await getRepo().update({ id }, { is_featured: !author.is_featured });
  return getAuthorById(id);
}

/**
 * Bulk update sort order
 */
export async function bulkUpdateSortOrder(items: { id: string; sortOrder: number }[]): Promise<void> {
  await Promise.all(
    items.map((item) => getRepo().update({ id: item.id }, { sort_order: item.sortOrder }))
  );
}

export default {
  listAuthors,
  getActiveAuthors,
  getFeaturedAuthors,
  getAuthorById,
  getAuthorBySlug,
  slugExists,
  emailExists,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  toggleActive,
  toggleFeatured,
  bulkUpdateSortOrder,
};
