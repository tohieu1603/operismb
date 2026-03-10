/**
 * Post Tags Repository
 * CRUD operations for post_tags table
 */

import { AppDataSource } from "../data-source";
import { PostTagEntity } from "../entities/post-tag.entity";

function getRepo() {
  return AppDataSource.getRepository(PostTagEntity);
}

/**
 * List all tags
 */
export async function listTags(options: {
  search?: string;
  isActive?: boolean;
} = {}): Promise<PostTagEntity[]> {
  const qb = getRepo().createQueryBuilder("t");

  if (options.search) {
    qb.andWhere("(t.name ILIKE :search OR t.slug ILIKE :search)", {
      search: `%${options.search}%`,
    });
  }

  if (options.isActive !== undefined) {
    qb.andWhere("t.is_active = :isActive", { isActive: options.isActive });
  }

  return qb.orderBy("t.name", "ASC").getMany();
}

/**
 * Get tag by ID
 */
export async function getTagById(id: string): Promise<PostTagEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get tag by slug
 */
export async function getTagBySlug(slug: string): Promise<PostTagEntity | null> {
  return getRepo().findOneBy({ slug });
}

/**
 * Get tag by name
 */
export async function getTagByName(name: string): Promise<PostTagEntity | null> {
  return getRepo().findOneBy({ name });
}

/**
 * Check slug exists
 */
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const qb = getRepo().createQueryBuilder("t").where("t.slug = :slug", { slug });
  if (excludeId) qb.andWhere("t.id != :excludeId", { excludeId });
  return (await qb.getCount()) > 0;
}

/**
 * Create tag
 */
export async function createTag(data: Partial<PostTagEntity>): Promise<PostTagEntity> {
  const tag = getRepo().create(data);
  return getRepo().save(tag);
}

/**
 * Update tag
 */
export async function updateTag(
  id: string,
  data: Partial<PostTagEntity>
): Promise<PostTagEntity | null> {
  if (Object.keys(data).length === 0) return getTagById(id);
  await getRepo().update({ id }, data);
  return getTagById(id);
}

/**
 * Delete tag
 */
export async function deleteTag(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Toggle active status
 */
export async function toggleActive(id: string): Promise<PostTagEntity | null> {
  const tag = await getTagById(id);
  if (!tag) return null;
  await getRepo().update({ id }, { is_active: !tag.is_active });
  return getTagById(id);
}

export default {
  listTags,
  getTagById,
  getTagBySlug,
  getTagByName,
  slugExists,
  createTag,
  updateTag,
  deleteTag,
  toggleActive,
};
