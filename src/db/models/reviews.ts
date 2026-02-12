/**
 * Reviews Repository
 * CRUD for reviews table
 */

import { query, queryOne, queryAll } from "../connection.js";

// ── Types ───────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  product_slug: string;
  user_id: string;
  author: string;
  rating: number;
  content: string | null;
  helpful: number;
  created_at: Date;
}

export interface ReviewCreate {
  product_slug: string;
  user_id: string;
  author: string;
  rating: number;
  content?: string;
}

export interface ReviewSummary {
  average: number;
  total: number;
  distribution: Record<number, number>;
}

// ── Review CRUD ─────────────────────────────────────────────────────────

export async function createReview(data: ReviewCreate): Promise<Review> {
  const result = await queryOne<Review>(
    `INSERT INTO reviews (product_slug, user_id, author, rating, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.product_slug, data.user_id, data.author, data.rating, data.content ?? null],
  );
  if (!result) throw new Error("Failed to create review");
  return result;
}

export async function getReviewsByProduct(
  productSlug: string,
  limit = 20,
  offset = 0,
  sort: "newest" | "helpful" = "newest",
): Promise<{ reviews: Review[]; total: number }> {
  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM reviews WHERE product_slug = $1",
    [productSlug],
  );

  const orderBy = sort === "helpful" ? "helpful DESC, created_at DESC" : "created_at DESC";

  const reviews = await queryAll<Review>(
    `SELECT * FROM reviews WHERE product_slug = $1 ORDER BY ${orderBy} LIMIT $2 OFFSET $3`,
    [productSlug, limit, offset],
  );

  return { reviews, total: parseInt(countResult?.count ?? "0", 10) };
}

export async function getReviewSummary(productSlug: string): Promise<ReviewSummary> {
  const stats = await queryOne<{ avg: string | null; count: string }>(
    "SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE product_slug = $1",
    [productSlug],
  );

  const dist = await queryAll<{ rating: number; count: string }>(
    "SELECT rating, COUNT(*) as count FROM reviews WHERE product_slug = $1 GROUP BY rating ORDER BY rating",
    [productSlug],
  );

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of dist) {
    distribution[row.rating] = parseInt(row.count, 10);
  }

  return {
    average: stats?.avg ? parseFloat(parseFloat(stats.avg).toFixed(1)) : 0,
    total: parseInt(stats?.count ?? "0", 10),
    distribution,
  };
}

export async function getUserReviewForProduct(
  userId: string,
  productSlug: string,
): Promise<Review | null> {
  return queryOne<Review>(
    "SELECT * FROM reviews WHERE user_id = $1 AND product_slug = $2",
    [userId, productSlug],
  );
}

export async function incrementHelpful(reviewId: string): Promise<Review | null> {
  return queryOne<Review>(
    "UPDATE reviews SET helpful = helpful + 1 WHERE id = $1 RETURNING *",
    [reviewId],
  );
}

export async function getReviewById(id: string): Promise<Review | null> {
  return queryOne<Review>("SELECT * FROM reviews WHERE id = $1", [id]);
}

/**
 * Check if user has purchased a product (has a delivered order with that product)
 */
export async function hasUserPurchased(
  userId: string,
  productSlug: string,
): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = $1 AND oi.product_slug = $2 AND o.status = 'delivered'
     ) as exists`,
    [userId, productSlug],
  );
  return result?.exists ?? false;
}

// ── Export ───────────────────────────────────────────────────────────────

export const reviewsRepo = {
  createReview,
  getReviewsByProduct,
  getReviewSummary,
  getUserReviewForProduct,
  incrementHelpful,
  getReviewById,
  hasUserPurchased,
};

export default reviewsRepo;
