/**
 * Post Categories Repository
 * CRUD operations for post_categories table
 */

import { AppDataSource } from "../data-source";
import { PostCategoryEntity } from "../entities/post-category.entity";

function getRepo() {
  return AppDataSource.getRepository(PostCategoryEntity);
}

export interface CategoryListOptions {
  search?: string;
  parentId?: string | "root";
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List categories with filters
 */
export async function listCategories(options: CategoryListOptions = {}): Promise<PostCategoryEntity[]> {
  const sortBy = options.sortBy ?? "sort_order";
  const sortOrder = (options.sortOrder ?? "ASC") as "ASC" | "DESC";

  const qb = getRepo()
    .createQueryBuilder("c")
    .leftJoinAndSelect("c.parent", "parent");

  if (options.search) {
    qb.andWhere("(c.name ILIKE :search OR c.slug ILIKE :search)", {
      search: `%${options.search}%`,
    });
  }

  if (options.parentId !== undefined) {
    if (options.parentId === "root") {
      qb.andWhere("c.parent_id IS NULL");
    } else {
      qb.andWhere("c.parent_id = :parentId", { parentId: options.parentId });
    }
  }

  if (options.isActive !== undefined) {
    qb.andWhere("c.is_active = :isActive", { isActive: options.isActive });
  }

  const validSortFields: Record<string, string> = {
    sort_order: "c.sort_order",
    sortOrder: "c.sort_order",
    name: "c.name",
    createdAt: "c.created_at",
  };
  const sortField = validSortFields[sortBy] ?? "c.sort_order";

  qb.orderBy(sortField, sortOrder).addOrderBy("c.name", "ASC");

  return qb.getMany();
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string): Promise<PostCategoryEntity | null> {
  return getRepo()
    .createQueryBuilder("c")
    .leftJoinAndSelect("c.parent", "parent")
    .where("c.id = :id", { id })
    .getOne();
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<PostCategoryEntity | null> {
  return getRepo()
    .createQueryBuilder("c")
    .leftJoinAndSelect("c.parent", "parent")
    .where("c.slug = :slug", { slug })
    .getOne();
}

/**
 * Get tree structure (root categories with children)
 */
export async function getCategoryTree(): Promise<PostCategoryEntity[]> {
  const all = await getRepo()
    .createQueryBuilder("c")
    .leftJoinAndSelect("c.parent", "parent")
    .orderBy("c.sort_order", "ASC")
    .addOrderBy("c.name", "ASC")
    .getMany();

  // Build tree
  const map = new Map<string, PostCategoryEntity & { children?: PostCategoryEntity[] }>();
  all.forEach((c) => map.set(c.id, { ...c, children: [] }));

  const roots: (PostCategoryEntity & { children?: PostCategoryEntity[] })[] = [];
  all.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id) {
      const parent = map.get(c.parent_id);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });
  return roots as PostCategoryEntity[];
}

/**
 * Check slug exists
 */
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const qb = getRepo().createQueryBuilder("c").where("c.slug = :slug", { slug });
  if (excludeId) qb.andWhere("c.id != :excludeId", { excludeId });
  return (await qb.getCount()) > 0;
}

/**
 * Check if category has children
 */
export async function hasChildren(id: string): Promise<boolean> {
  const count = await getRepo().count({ where: { parent_id: id } });
  return count > 0;
}

/**
 * Create category
 */
export async function createCategory(data: Partial<PostCategoryEntity>): Promise<PostCategoryEntity> {
  const category = getRepo().create(data);
  return getRepo().save(category);
}

/**
 * Update category
 */
export async function updateCategory(
  id: string,
  data: Partial<PostCategoryEntity>
): Promise<PostCategoryEntity | null> {
  if (Object.keys(data).length === 0) return getCategoryById(id);
  await getRepo().update({ id }, data);
  return getCategoryById(id);
}

/**
 * Delete category
 */
export async function deleteCategory(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Toggle active status
 */
export async function toggleActive(id: string): Promise<PostCategoryEntity | null> {
  const category = await getCategoryById(id);
  if (!category) return null;
  await getRepo().update({ id }, { is_active: !category.is_active });
  return getCategoryById(id);
}

export default {
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  getCategoryTree,
  slugExists,
  hasChildren,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleActive,
};
