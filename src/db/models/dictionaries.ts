/**
 * Dictionaries Repository
 * CRUD operations for dictionary_terms table
 */

import { AppDataSource } from "../data-source";
import { DictionaryEntity } from "../entities/dictionary.entity";

function getRepo() {
  return AppDataSource.getRepository(DictionaryEntity);
}

export interface DictionaryListOptions {
  page?: number;
  limit?: number;
  search?: string;
  letter?: string;
  categoryId?: string;
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List dictionary terms with pagination and filters
 */
export async function listDictionary(
  options: DictionaryListOptions = {}
): Promise<{ data: DictionaryEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy ?? "term";
  const sortOrder = (options.sortOrder ?? "ASC") as "ASC" | "DESC";

  const qb = getRepo()
    .createQueryBuilder("d")
    .leftJoinAndSelect("d.category", "category");

  if (options.search) {
    qb.andWhere(
      "(d.term ILIKE :search OR d.definition ILIKE :search OR d.description ILIKE :search)",
      { search: `%${options.search}%` }
    );
  }

  if (options.letter && options.letter.length === 1) {
    qb.andWhere("d.term ILIKE :letter", { letter: `${options.letter}%` });
  }

  if (options.categoryId) {
    qb.andWhere("d.category_id = :categoryId", { categoryId: options.categoryId });
  }

  if (options.isActive !== undefined) {
    qb.andWhere("d.is_active = :isActive", { isActive: options.isActive });
  }

  if (options.isFeatured !== undefined) {
    qb.andWhere("d.is_featured = :isFeatured", { isFeatured: options.isFeatured });
  }

  const validSortFields: Record<string, string> = {
    term: "d.term",
    createdAt: "d.created_at",
    viewCount: "d.view_count",
    sort_order: "d.sort_order",
  };
  const sortField = validSortFields[sortBy] ?? "d.term";
  qb.orderBy(sortField, sortOrder).take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get term by ID
 */
export async function getDictionaryById(id: string): Promise<DictionaryEntity | null> {
  return getRepo()
    .createQueryBuilder("d")
    .leftJoinAndSelect("d.category", "category")
    .where("d.id = :id", { id })
    .getOne();
}

/**
 * Get term by slug
 */
export async function getDictionaryBySlug(slug: string): Promise<DictionaryEntity | null> {
  return getRepo()
    .createQueryBuilder("d")
    .leftJoinAndSelect("d.category", "category")
    .where("d.slug = :slug", { slug })
    .getOne();
}

/**
 * Get term by exact term name
 */
export async function getDictionaryByTerm(term: string): Promise<DictionaryEntity | null> {
  return getRepo()
    .createQueryBuilder("d")
    .where("LOWER(d.term) = LOWER(:term)", { term })
    .getOne();
}

/**
 * Check slug exists
 */
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const qb = getRepo().createQueryBuilder("d").where("d.slug = :slug", { slug });
  if (excludeId) qb.andWhere("d.id != :excludeId", { excludeId });
  return (await qb.getCount()) > 0;
}

/**
 * Get alphabet index
 */
export async function getAlphabetIndex(
  isActive = true
): Promise<Array<{ letter: string; count: number }>> {
  const qb = getRepo()
    .createQueryBuilder("d")
    .select("UPPER(SUBSTRING(d.term, 1, 1))", "letter")
    .addSelect("COUNT(*)", "count")
    .groupBy("UPPER(SUBSTRING(d.term, 1, 1))")
    .orderBy("UPPER(SUBSTRING(d.term, 1, 1))", "ASC");

  if (isActive) {
    qb.where("d.is_active = :isActive", { isActive: true });
  }

  const results = await qb.getRawMany();
  return results.map((r: { letter: string; count: string }) => ({
    letter: r.letter,
    count: parseInt(r.count, 10),
  }));
}

/**
 * Get featured terms
 */
export async function getFeaturedTerms(limit = 10): Promise<DictionaryEntity[]> {
  return getRepo()
    .createQueryBuilder("d")
    .leftJoinAndSelect("d.category", "category")
    .where("d.is_active = :isActive", { isActive: true })
    .andWhere("d.is_featured = :isFeatured", { isFeatured: true })
    .orderBy("d.sort_order", "ASC")
    .addOrderBy("d.term", "ASC")
    .take(limit)
    .getMany();
}

/**
 * Get popular terms (most viewed)
 */
export async function getPopularTerms(limit = 10): Promise<DictionaryEntity[]> {
  return getRepo()
    .createQueryBuilder("d")
    .where("d.is_active = :isActive", { isActive: true })
    .orderBy("d.view_count", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Get recent terms
 */
export async function getRecentTerms(limit = 10): Promise<DictionaryEntity[]> {
  return getRepo()
    .createQueryBuilder("d")
    .where("d.is_active = :isActive", { isActive: true })
    .orderBy("d.created_at", "DESC")
    .take(limit)
    .getMany();
}

/**
 * Get suggestions (autocomplete)
 */
export async function getSuggestions(
  query: string,
  limit = 10
): Promise<Array<{ term: string; slug: string }>> {
  if (!query || query.length < 2) return [];

  const results = await getRepo()
    .createQueryBuilder("d")
    .select(["d.term", "d.slug"])
    .where("d.is_active = :isActive", { isActive: true })
    .andWhere("d.term ILIKE :query", { query: `%${query}%` })
    .orderBy("d.term", "ASC")
    .take(limit)
    .getMany();

  return results.map((d) => ({ term: d.term, slug: d.slug }));
}

/**
 * Get terms by category
 */
export async function getTermsByCategory(categoryId: string, limit = 50): Promise<DictionaryEntity[]> {
  return getRepo()
    .createQueryBuilder("d")
    .where("d.category_id = :categoryId", { categoryId })
    .andWhere("d.is_active = :isActive", { isActive: true })
    .orderBy("d.term", "ASC")
    .take(limit)
    .getMany();
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
 * Create dictionary term
 */
export async function createDictionary(data: Partial<DictionaryEntity>): Promise<DictionaryEntity> {
  const term = getRepo().create(data);
  return getRepo().save(term);
}

/**
 * Update dictionary term
 */
export async function updateDictionary(
  id: string,
  data: Partial<DictionaryEntity>
): Promise<DictionaryEntity | null> {
  if (Object.keys(data).length === 0) return getDictionaryById(id);
  await getRepo().update({ id }, data);
  return getDictionaryById(id);
}

/**
 * Delete dictionary term
 */
export async function deleteDictionary(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Toggle active
 */
export async function toggleActive(id: string): Promise<DictionaryEntity | null> {
  const term = await getDictionaryById(id);
  if (!term) return null;
  await getRepo().update({ id }, { is_active: !term.is_active });
  return getDictionaryById(id);
}

/**
 * Toggle featured
 */
export async function toggleFeatured(id: string): Promise<DictionaryEntity | null> {
  const term = await getDictionaryById(id);
  if (!term) return null;
  await getRepo().update({ id }, { is_featured: !term.is_featured });
  return getDictionaryById(id);
}

/**
 * Bulk import
 */
export async function bulkImport(
  terms: Partial<DictionaryEntity>[]
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  for (const termData of terms) {
    try {
      await createDictionary(termData);
      inserted++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to import "${termData.term}": ${message}`);
    }
  }

  return { inserted, errors };
}

export default {
  listDictionary,
  getDictionaryById,
  getDictionaryBySlug,
  getDictionaryByTerm,
  slugExists,
  getAlphabetIndex,
  getFeaturedTerms,
  getPopularTerms,
  getRecentTerms,
  getSuggestions,
  getTermsByCategory,
  incrementViewCount,
  createDictionary,
  updateDictionary,
  deleteDictionary,
  toggleActive,
  toggleFeatured,
  bulkImport,
};
