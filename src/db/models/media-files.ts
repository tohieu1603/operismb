/**
 * Media Files Repository
 * CRUD operations for media table
 */

import { AppDataSource } from "../data-source";
import { MediaEntity, MediaType } from "../entities/media.entity";

function getRepo() {
  return AppDataSource.getRepository(MediaEntity);
}

export interface MediaListOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: MediaType;
  folder?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List media with filters and pagination
 */
export async function listMedia(
  options: MediaListOptions = {}
): Promise<{ data: MediaEntity[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy ?? "created_at";
  const sortOrder = (options.sortOrder ?? "DESC") as "ASC" | "DESC";

  const qb = getRepo().createQueryBuilder("m");

  if (options.search) {
    qb.andWhere("(m.original_name ILIKE :search OR m.alt_text ILIKE :search)", {
      search: `%${options.search}%`,
    });
  }

  if (options.type) {
    qb.andWhere("m.type = :type", { type: options.type });
  }

  if (options.folder) {
    qb.andWhere("m.folder = :folder", { folder: options.folder });
  }

  const validSortFields: Record<string, string> = {
    createdAt: "m.created_at",
    originalName: "m.original_name",
    size: "m.size",
    type: "m.type",
  };
  const sortField = validSortFields[sortBy] ?? "m.created_at";
  qb.orderBy(sortField, sortOrder).take(limit).skip(offset);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}

/**
 * Get media by ID
 */
export async function getMediaById(id: string): Promise<MediaEntity | null> {
  return getRepo().findOneBy({ id });
}

/**
 * Get media by filename
 */
export async function getMediaByFilename(filename: string): Promise<MediaEntity | null> {
  return getRepo().findOneBy({ filename });
}

/**
 * Get distinct folders
 */
export async function getFolders(): Promise<string[]> {
  const result = await getRepo()
    .createQueryBuilder("m")
    .select("DISTINCT m.folder", "folder")
    .where("m.folder IS NOT NULL")
    .getRawMany();
  return result
    .map((r: { folder: string }) => r.folder)
    .filter(Boolean)
    .sort();
}

/**
 * Find media by page/section assignment
 */
export async function findBySection(
  pageSlug: string,
  sectionKey?: string
): Promise<MediaEntity[]> {
  const qb = getRepo()
    .createQueryBuilder("m")
    .where("m.assignments @> :assignment", {
      assignment: JSON.stringify([{ pageSlug }]),
    });

  if (sectionKey) {
    qb.andWhere("m.assignments @> :sectionAssignment", {
      sectionAssignment: JSON.stringify([{ pageSlug, sectionKey }]),
    });
  }

  return qb.orderBy("m.created_at", "DESC").getMany();
}

/**
 * Create media
 */
export async function createMedia(data: Partial<MediaEntity>): Promise<MediaEntity> {
  const media = getRepo().create(data);
  return getRepo().save(media);
}

/**
 * Update media
 */
export async function updateMedia(
  id: string,
  data: Partial<MediaEntity>
): Promise<MediaEntity | null> {
  if (Object.keys(data).length === 0) return getMediaById(id);
  await getRepo().update({ id }, data);
  return getMediaById(id);
}

/**
 * Delete media
 */
export async function deleteMedia(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * Update usage array (add usage)
 */
export async function addUsage(
  id: string,
  usage: { entityType: string; entityId: string; field: string }
): Promise<void> {
  const media = await getMediaById(id);
  if (!media) return;
  const usedIn = media.used_in ?? [];
  const exists = usedIn.some(
    (u) => u.entityType === usage.entityType && u.entityId === usage.entityId && u.field === usage.field
  );
  if (!exists) {
    usedIn.push(usage);
    await getRepo().update({ id }, { used_in: usedIn });
  }
}

/**
 * Remove usage
 */
export async function removeUsage(
  id: string,
  entityType: string,
  entityId: string
): Promise<void> {
  const media = await getMediaById(id);
  if (!media || !media.used_in) return;
  const usedIn = media.used_in.filter(
    (u) => !(u.entityType === entityType && u.entityId === entityId)
  );
  await getRepo().update({ id }, { used_in: usedIn });
}

/**
 * Assign media to a page section
 */
export async function assignToSection(
  id: string,
  assignment: { pageSlug: string; sectionKey: string; elementId?: string }
): Promise<MediaEntity | null> {
  const media = await getMediaById(id);
  if (!media) return null;
  const assignments = media.assignments ?? [];
  const exists = assignments.some(
    (a) => a.pageSlug === assignment.pageSlug && a.sectionKey === assignment.sectionKey
  );
  if (!exists) {
    assignments.push(assignment);
    await getRepo().update({ id }, { assignments });
  }
  return getMediaById(id);
}

/**
 * Unassign media from a page section
 */
export async function unassignFromSection(
  id: string,
  pageSlug: string,
  sectionKey: string
): Promise<MediaEntity | null> {
  const media = await getMediaById(id);
  if (!media) return null;
  const assignments = (media.assignments ?? []).filter(
    (a) => !(a.pageSlug === pageSlug && a.sectionKey === sectionKey)
  );
  await getRepo().update({ id }, { assignments });
  return getMediaById(id);
}

export default {
  listMedia,
  getMediaById,
  getMediaByFilename,
  getFolders,
  findBySection,
  createMedia,
  updateMedia,
  deleteMedia,
  addUsage,
  removeUsage,
  assignToSection,
  unassignFromSection,
};
