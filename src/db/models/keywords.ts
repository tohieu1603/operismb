/**
 * Keywords Repository
 * CRUD operations for keywords table
 */

import { AppDataSource } from "../data-source";
import { KeywordEntity } from "../entities/keyword.entity";

function getRepo() {
  return AppDataSource.getRepository(KeywordEntity);
}

export interface KeywordListOptions {
  page?: number;
  limit?: number;
  search?: string;
  postId?: string;
  isTracking?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List keywords with pagination
 */
export async function listKeywords(
  options: KeywordListOptions = {}
): Promise<{ data: KeywordEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy ?? "created_at";
  const sortOrder = (options.sortOrder ?? "DESC") as "ASC" | "DESC";

  const qb = getRepo().createQueryBuilder("k");

  if (options.search) {
    qb.andWhere("k.keyword ILIKE :search", { search: `%${options.search}%` });
  }

  if (options.postId) {
    qb.andWhere("k.post_id = :postId", { postId: options.postId });
  }

  if (options.isTracking !== undefined) {
    qb.andWhere("k.is_tracking = :isTracking", { isTracking: options.isTracking });
  }

  const validSortFields: Record<string, string> = {
    keyword: "k.keyword",
    current_position: "k.current_position",
    search_volume: "k.search_volume",
    createdAt: "k.created_at",
  };
  const sortField = validSortFields[sortBy] ?? "k.created_at";
  qb.orderBy(sortField, sortOrder).take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get keyword by ID
 */
export async function getKeywordById(id: string): Promise<KeywordEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get keywords by post
 */
export async function getKeywordsByPost(postId: string): Promise<KeywordEntity[]> {
  return getRepo()
    .createQueryBuilder("k")
    .where("k.post_id = :postId", { postId })
    .orderBy("k.keyword", "ASC")
    .getMany();
}

/**
 * Create keyword
 */
export async function createKeyword(data: Partial<KeywordEntity>): Promise<KeywordEntity> {
  const keyword = getRepo().create(data);
  return getRepo().save(keyword);
}

/**
 * Update keyword
 */
export async function updateKeyword(
  id: string,
  data: Partial<KeywordEntity>
): Promise<KeywordEntity | null> {
  if (Object.keys(data).length === 0) return getKeywordById(id);
  await getRepo().update({ id }, data as object);
  return getKeywordById(id);
}

/**
 * Delete keyword
 */
export async function deleteKeyword(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Bulk create keywords
 */
export async function bulkCreateKeywords(data: Partial<KeywordEntity>[]): Promise<KeywordEntity[]> {
  const entities = data.map((d) => getRepo().create(d));
  return getRepo().save(entities);
}

export default {
  listKeywords,
  getKeywordById,
  getKeywordsByPost,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  bulkCreateKeywords,
};
