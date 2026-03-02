/**
 * Cart Controller - Cart sync endpoints
 */

import type { Request, Response, NextFunction } from "express";
import { cartService } from "../services/cart.service";

/** GET /api/cart — Load cart from server */
export async function getCart(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await cartService.getCart(req.user!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/** PUT /api/cart — Replace entire cart */
export async function replaceCart(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await cartService.replaceCart(req.user!.userId, req.body.items);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/** POST /api/cart/merge — Merge local cart with server cart */
export async function mergeCart(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await cartService.mergeCart(req.user!.userId, req.body.local_items);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
