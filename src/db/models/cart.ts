/**
 * Cart Repository
 * CRUD for cart_items (user_id, product_slug, quantity)
 */

import { query, queryOne, queryAll, transaction } from "../connection";
import type pg from "pg";

// ── Types ───────────────────────────────────────────────────────────────

export interface CartItem {
  id: number;
  user_id: number;
  product_slug: string;
  quantity: number;
  updated_at: Date;
}

export interface CartItemDTO {
  product_slug: string;
  quantity: number;
}

// ── Queries ─────────────────────────────────────────────────────────────

/** Get all cart items for a user */
export async function getCartByUserId(userId: string): Promise<CartItemDTO[]> {
  const rows = await queryAll<CartItem>(
    "SELECT product_slug, quantity FROM cart_items WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId],
  );
  return rows.map((r) => ({ product_slug: r.product_slug, quantity: r.quantity }));
}

/** Replace entire cart for a user (within transaction) */
export async function replaceCart(userId: string, items: CartItemDTO[]): Promise<void> {
  await transaction(async (client) => {
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

    for (const item of items) {
      await client.query(
        `INSERT INTO cart_items (user_id, product_slug, quantity, updated_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, item.product_slug, item.quantity],
      );
    }
  });
}

/** Merge local items with server cart — take max quantity per slug */
export async function mergeCart(
  userId: string,
  localItems: CartItemDTO[],
): Promise<CartItemDTO[]> {
  return transaction(async (client) => {
    // Get current server cart
    const serverRows = await client.query<CartItem>(
      "SELECT product_slug, quantity FROM cart_items WHERE user_id = $1",
      [userId],
    );
    const serverMap = new Map<string, number>();
    for (const row of serverRows.rows) {
      serverMap.set(row.product_slug, row.quantity);
    }

    // Merge: take max quantity
    for (const local of localItems) {
      const serverQty = serverMap.get(local.product_slug) ?? 0;
      serverMap.set(local.product_slug, Math.max(serverQty, local.quantity));
    }

    // Clear and re-insert
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

    const merged: CartItemDTO[] = [];
    for (const [product_slug, quantity] of serverMap) {
      await client.query(
        `INSERT INTO cart_items (user_id, product_slug, quantity, updated_at)
         VALUES ($1, $2, $3, NOW())`,
        [userId, product_slug, quantity],
      );
      merged.push({ product_slug, quantity });
    }

    return merged;
  });
}

// ── Export ───────────────────────────────────────────────────────────────

export const cartRepo = {
  getCartByUserId,
  replaceCart,
  mergeCart,
};

export default cartRepo;
