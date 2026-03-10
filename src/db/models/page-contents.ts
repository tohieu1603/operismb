/**
 * Page Contents Repository
 * CRUD operations for page_contents table
 */

import { AppDataSource } from "../data-source";
import { PageContentEntity } from "../entities/page-content.entity";

function getRepo() {
  return AppDataSource.getRepository(PageContentEntity);
}

/**
 * Get all pages
 */
export async function listPageContents(activeOnly = true): Promise<PageContentEntity[]> {
  const qb = getRepo().createQueryBuilder("p");
  if (activeOnly) {
    qb.andWhere("p.is_active = :isActive", { isActive: true });
  }
  return qb.orderBy("p.page_name", "ASC").getMany();
}

/**
 * Get page by slug
 */
export async function getPageContentBySlug(
  pageSlug: string,
  activeOnly = false
): Promise<PageContentEntity | null> {
  const qb = getRepo().createQueryBuilder("p").where("p.page_slug = :pageSlug", { pageSlug });
  if (activeOnly) {
    qb.andWhere("p.is_active = :isActive", { isActive: true });
  }
  return qb.getOne();
}

/**
 * Get page by ID
 */
export async function getPageContentById(id: string): Promise<PageContentEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Check slug exists
 */
export async function pageSlugExists(pageSlug: string): Promise<boolean> {
  const count = await getRepo().count({ where: { page_slug: pageSlug } });
  return count > 0;
}

/**
 * Create page content
 */
export async function createPageContent(
  data: Partial<PageContentEntity>
): Promise<PageContentEntity> {
  const page = getRepo().create(data);
  return getRepo().save(page);
}

/**
 * Update page content by slug
 */
export async function updatePageContentBySlug(
  pageSlug: string,
  data: Partial<PageContentEntity>
): Promise<PageContentEntity | null> {
  await getRepo()
    .createQueryBuilder()
    .update()
    .set(data as object)
    .where("page_slug = :pageSlug", { pageSlug })
    .execute();
  return getPageContentBySlug(pageSlug);
}

/**
 * Upsert page content by slug
 */
export async function upsertPageContent(
  pageSlug: string,
  data: Partial<PageContentEntity>
): Promise<PageContentEntity> {
  const existing = await getPageContentBySlug(pageSlug);
  if (existing) {
    await getRepo().update({ id: existing.id }, { ...data, page_slug: pageSlug } as object);
    return (await getPageContentById(existing.id))!;
  }
  return createPageContent({ ...data, page_slug: pageSlug });
}

/**
 * Delete page content by slug
 */
export async function deletePageContentBySlug(pageSlug: string): Promise<boolean> {
  const result = await getRepo()
    .createQueryBuilder()
    .delete()
    .where("page_slug = :pageSlug", { pageSlug })
    .execute();
  return (result.affected ?? 0) > 0;
}

/**
 * Toggle active status
 */
export async function toggleActive(pageSlug: string): Promise<PageContentEntity | null> {
  const page = await getPageContentBySlug(pageSlug);
  if (!page) return null;
  await getRepo().update({ id: page.id }, { is_active: !page.is_active });
  return getPageContentBySlug(pageSlug);
}

export default {
  listPageContents,
  getPageContentBySlug,
  getPageContentById,
  pageSlugExists,
  createPageContent,
  updatePageContentBySlug,
  upsertPageContent,
  deletePageContentBySlug,
  toggleActive,
};
