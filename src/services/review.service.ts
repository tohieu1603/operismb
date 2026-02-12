/**
 * Review Service - Product reviews with purchase verification
 */

import { Errors } from "../core/errors/api-error";
import { reviewsRepo, productsRepo, usersRepo } from "../db/index";
import type { Review, ReviewSummary } from "../db/models/reviews";

class ReviewService {
  async getProductReviews(
    productSlug: string,
    limit = 20,
    offset = 0,
    sort: "newest" | "helpful" = "newest",
  ): Promise<{
    reviews: Review[];
    summary: ReviewSummary;
    total: number;
  }> {
    const [reviewResult, summary] = await Promise.all([
      reviewsRepo.getReviewsByProduct(productSlug, limit, offset, sort),
      reviewsRepo.getReviewSummary(productSlug),
    ]);

    return {
      reviews: reviewResult.reviews,
      summary,
      total: reviewResult.total,
    };
  }

  async createReview(
    userId: string,
    productSlug: string,
    rating: number,
    content?: string,
  ): Promise<Review> {
    // Validate rating
    if (rating < 1 || rating > 5) throw Errors.badRequest("Rating must be 1-5");

    // Check product exists
    const product = await productsRepo.getProductBySlug(productSlug);
    if (!product) throw Errors.notFound("Product");

    // Check user hasn't already reviewed
    const existing = await reviewsRepo.getUserReviewForProduct(userId, productSlug);
    if (existing) throw Errors.conflict("You have already reviewed this product");

    // Get user name for author
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");

    const review = await reviewsRepo.createReview({
      product_slug: productSlug,
      user_id: userId,
      author: user.name || user.email.split("@")[0],
      rating,
      content,
    });

    // Update product's denormalized rating
    await productsRepo.updateProductRating(productSlug);

    return review;
  }

  async markHelpful(reviewId: string): Promise<Review> {
    const review = await reviewsRepo.incrementHelpful(reviewId);
    if (!review) throw Errors.notFound("Review");
    return review;
  }

  async checkPurchase(userId: string, productSlug: string): Promise<{ purchased: boolean }> {
    const purchased = await reviewsRepo.hasUserPurchased(userId, productSlug);
    return { purchased };
  }
}

export const reviewService = new ReviewService();
