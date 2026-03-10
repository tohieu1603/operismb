/**
 * Index Statuses Repository
 * CRUD operations for index_statuses table
 */

import { AppDataSource } from "../data-source";
import {
  IndexStatusEntity,
  IndexStatusType,
  UrlType,
  SubmissionMethod,
} from "../entities/index-status.entity";

function getRepo() {
  return AppDataSource.getRepository(IndexStatusEntity);
}

export interface IndexStatusListOptions {
  page?: number;
  limit?: number;
  status?: IndexStatusType;
  urlType?: UrlType;
  postId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List index statuses with pagination
 */
export async function listIndexStatuses(
  options: IndexStatusListOptions = {}
): Promise<{ data: IndexStatusEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy ?? "created_at";
  const sortOrder = (options.sortOrder ?? "DESC") as "ASC" | "DESC";

  const qb = getRepo().createQueryBuilder("i");

  if (options.status) {
    qb.andWhere("i.status = :status", { status: options.status });
  }

  if (options.urlType) {
    qb.andWhere("i.url_type = :urlType", { urlType: options.urlType });
  }

  if (options.postId) {
    qb.andWhere("i.post_id = :postId", { postId: options.postId });
  }

  if (options.search) {
    qb.andWhere("i.url ILIKE :search", { search: `%${options.search}%` });
  }

  const validSortFields: Record<string, string> = {
    createdAt: "i.created_at",
    url: "i.url",
    status: "i.status",
    submittedAt: "i.submitted_at",
  };
  const sortField = validSortFields[sortBy] ?? "i.created_at";
  qb.orderBy(sortField, sortOrder).take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get index status by ID
 */
export async function getIndexStatusById(id: string): Promise<IndexStatusEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get index status by URL
 */
export async function getIndexStatusByUrl(url: string): Promise<IndexStatusEntity | null> {
  return getRepo().findOneBy({ url });
}

/**
 * Get index status by post ID
 */
export async function getIndexStatusByPost(postId: string): Promise<IndexStatusEntity | null> {
  return getRepo()
    .createQueryBuilder("i")
    .where("i.post_id = :postId", { postId })
    .getOne();
}

/**
 * Create index status
 */
export async function createIndexStatus(
  data: Partial<IndexStatusEntity>
): Promise<IndexStatusEntity> {
  const status = getRepo().create(data);
  return getRepo().save(status);
}

/**
 * Update index status
 */
export async function updateIndexStatus(
  id: string,
  data: Partial<IndexStatusEntity>
): Promise<IndexStatusEntity | null> {
  if (Object.keys(data).length === 0) return getIndexStatusById(id);
  await getRepo().update({ id }, data as object);
  return getIndexStatusById(id);
}

/**
 * Upsert index status by URL
 */
export async function upsertIndexStatusByUrl(
  url: string,
  data: Partial<IndexStatusEntity>
): Promise<IndexStatusEntity> {
  const existing = await getIndexStatusByUrl(url);
  if (existing) {
    await getRepo().update({ id: existing.id }, data as object);
    return (await getIndexStatusById(existing.id))!;
  }
  return createIndexStatus({ ...data, url });
}

/**
 * Delete index status
 */
export async function deleteIndexStatus(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Update status after submission
 */
export async function markSubmitted(
  id: string,
  method: SubmissionMethod
): Promise<IndexStatusEntity | null> {
  await getRepo().update(
    { id },
    {
      status: "submitted" as IndexStatusType,
      submitted_at: new Date(),
      submission_method: method,
    }
  );
  return getIndexStatusById(id);
}

/**
 * Count by status
 */
export async function countByStatus(): Promise<Record<string, number>> {
  const results = await getRepo()
    .createQueryBuilder("i")
    .select("i.status", "status")
    .addSelect("COUNT(*)", "count")
    .groupBy("i.status")
    .getRawMany();

  const counts: Record<string, number> = {};
  results.forEach((r: { status: string; count: string }) => {
    counts[r.status] = parseInt(r.count, 10);
  });
  return counts;
}

export default {
  listIndexStatuses,
  getIndexStatusById,
  getIndexStatusByUrl,
  getIndexStatusByPost,
  createIndexStatus,
  updateIndexStatus,
  upsertIndexStatusByUrl,
  deleteIndexStatus,
  markSubmitted,
  countByStatus,
};
