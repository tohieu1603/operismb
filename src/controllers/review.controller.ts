/**
 * Review Controller - Product reviews
 */

import type { Request, Response, NextFunction } from "express";
import { reviewService } from "../services/review.service";

export async function getProductReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const sort = (req.query.sort as "newest" | "helpful") || "newest";

    const result = await reviewService.getProductReviews(req.params.slug, limit, offset, sort);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { rating, content } = req.body;

    const review = await reviewService.createReview(userId, req.params.slug, rating, content);
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
}

export async function markHelpful(req: Request, res: Response, next: NextFunction) {
  try {
    const review = await reviewService.markHelpful(req.params.id);
    res.json(review);
  } catch (error) {
    next(error);
  }
}

export async function checkPurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await reviewService.checkPurchase(userId, req.params.slug);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
