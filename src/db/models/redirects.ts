/**
 * Redirects Repository
 * CRUD operations for redirects table
 */

import { AppDataSource } from "../data-source";
import { RedirectEntity } from "../entities/redirect.entity";

function getRepo() {
  return AppDataSource.getRepository(RedirectEntity);
}

/**
 * List all redirects
 */
export async function listRedirects(options: {
  isActive?: boolean;
  search?: string;
} = {}): Promise<RedirectEntity[]> {
  const qb = getRepo().createQueryBuilder("r");

  if (options.isActive !== undefined) {
    qb.andWhere("r.is_active = :isActive", { isActive: options.isActive });
  }

  if (options.search) {
    qb.andWhere("(r.from_path ILIKE :search OR r.to_path ILIKE :search)", {
      search: `%${options.search}%`,
    });
  }

  return qb.orderBy("r.from_path", "ASC").getMany();
}

/**
 * Get redirect by ID
 */
export async function getRedirectById(id: string): Promise<RedirectEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get redirect by from_path
 */
export async function getRedirectByFromPath(fromPath: string): Promise<RedirectEntity | null> {
  return getRepo().findOneBy({ from_path: fromPath });
}

/**
 * Get active redirects
 */
export async function getActiveRedirects(): Promise<RedirectEntity[]> {
  return getRepo()
    .createQueryBuilder("r")
    .where("r.is_active = :isActive", { isActive: true })
    .orderBy("r.from_path", "ASC")
    .getMany();
}

/**
 * Increment hit count
 */
export async function incrementHitCount(id: string): Promise<void> {
  await getRepo()
    .createQueryBuilder()
    .update()
    .set({ hit_count: () => "hit_count + 1" })
    .where("id = :id", { id })
    .execute();
}

/**
 * Create redirect
 */
export async function createRedirect(data: Partial<RedirectEntity>): Promise<RedirectEntity> {
  const redirect = getRepo().create(data);
  return getRepo().save(redirect);
}

/**
 * Update redirect
 */
export async function updateRedirect(
  id: string,
  data: Partial<RedirectEntity>
): Promise<RedirectEntity | null> {
  if (Object.keys(data).length === 0) return getRedirectById(id);
  await getRepo().update({ id }, data);
  return getRedirectById(id);
}

/**
 * Delete redirect
 */
export async function deleteRedirect(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Toggle active status
 */
export async function toggleActive(id: string): Promise<RedirectEntity | null> {
  const redirect = await getRedirectById(id);
  if (!redirect) return null;
  await getRepo().update({ id }, { is_active: !redirect.is_active });
  return getRedirectById(id);
}

export default {
  listRedirects,
  getRedirectById,
  getRedirectByFromPath,
  getActiveRedirects,
  incrementHitCount,
  createRedirect,
  updateRedirect,
  deleteRedirect,
  toggleActive,
};
