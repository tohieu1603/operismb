/**
 * SEO Scores Repository
 * CRUD operations for seo_scores table
 */

import { AppDataSource } from "../data-source";
import { SeoScoreEntity } from "../entities/seo-score.entity";

function getRepo() {
  return AppDataSource.getRepository(SeoScoreEntity);
}

/**
 * Get latest SEO score for a post
 */
export async function getLatestScoreByPost(postId: string): Promise<SeoScoreEntity | null> {
  return getRepo()
    .createQueryBuilder("s")
    .where("s.post_id = :postId", { postId })
    .orderBy("s.checked_at", "DESC")
    .getOne();
}

/**
 * Get score history for a post
 */
export async function getScoreHistoryByPost(
  postId: string,
  limit = 10
): Promise<SeoScoreEntity[]> {
  return getRepo()
    .createQueryBuilder("s")
    .where("s.post_id = :postId", { postId })
    .orderBy("s.checked_at", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Get score by ID
 */
export async function getScoreById(id: string): Promise<SeoScoreEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * List scores with pagination
 */
export async function listScores(options: {
  page?: number;
  limit?: number;
  postId?: string;
  minScore?: number;
} = {}): Promise<{ data: SeoScoreEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const qb = getRepo().createQueryBuilder("s");

  if (options.postId) {
    qb.andWhere("s.post_id = :postId", { postId: options.postId });
  }

  if (options.minScore !== undefined) {
    qb.andWhere("s.overall_score >= :minScore", { minScore: options.minScore });
  }

  qb.orderBy("s.checked_at", "DESC").take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Create SEO score
 */
export async function createSeoScore(data: Partial<SeoScoreEntity>): Promise<SeoScoreEntity> {
  const score = getRepo().create(data);
  return getRepo().save(score);
}

/**
 * Delete score
 */
export async function deleteSeoScore(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Delete old scores for a post (keep latest N)
 */
export async function pruneScores(postId: string, keepLatest = 10): Promise<void> {
  const scores = await getRepo()
    .createQueryBuilder("s")
    .select("s.id")
    .where("s.post_id = :postId", { postId })
    .orderBy("s.checked_at", "DESC")
    .getMany();

  const toDelete = scores.slice(keepLatest).map((s) => s.id);
  if (toDelete.length > 0) {
    await getRepo()
      .createQueryBuilder()
      .delete()
      .whereInIds(toDelete)
      .execute();
  }
}

export default {
  getLatestScoreByPost,
  getScoreHistoryByPost,
  getScoreById,
  listScores,
  createSeoScore,
  deleteSeoScore,
  pruneScores,
};
