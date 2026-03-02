/**
 * Cart Service - Cart sync logic (get, replace, merge)
 */

import { Errors } from "../core/errors/api-error";
import { cartRepo, productsRepo } from "../db/index";
import type { CartItemDTO } from "../db/models/cart";
import { MSG } from "../constants/messages";

class CartService {
  /** Get cart items for authenticated user */
  async getCart(userId: string): Promise<{ items: CartItemDTO[] }> {
    const items = await cartRepo.getCartByUserId(userId);
    return { items };
  }

  /** Replace entire cart (PUT) */
  async replaceCart(userId: string, items: CartItemDTO[]): Promise<{ success: boolean }> {
    this.validateItems(items);
    await this.validateProductSlugs(items);
    await cartRepo.replaceCart(userId, items);
    return { success: true };
  }

  /** Merge local cart with server cart (POST on login) */
  async mergeCart(userId: string, localItems: CartItemDTO[]): Promise<{ items: CartItemDTO[] }> {
    this.validateItems(localItems);
    await this.validateProductSlugs(localItems);
    const merged = await cartRepo.mergeCart(userId, localItems);
    return { items: merged };
  }

  /** Validate items array structure */
  private validateItems(items: CartItemDTO[]): void {
    if (!Array.isArray(items)) {
      throw Errors.validation(MSG.CART_ITEMS_REQUIRED);
    }

    for (const item of items) {
      if (
        !item.product_slug ||
        typeof item.product_slug !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        throw Errors.validation(MSG.CART_INVALID_ITEM);
      }
    }
  }

  /** Validate all product_slugs exist in products table */
  private async validateProductSlugs(items: CartItemDTO[]): Promise<void> {
    for (const item of items) {
      const product = await productsRepo.getProductBySlug(item.product_slug);
      if (!product) {
        throw Errors.notFound(MSG.CART_PRODUCT_NOT_FOUND(item.product_slug));
      }
    }
  }
}

export const cartService = new CartService();
