/**
 * Products Repository
 * CRUD for products, product_tags, product_specs, product_full_specs
 */

import { query, queryOne, queryAll, transaction } from "../connection.js";
import type pg from "pg";

// ── Types ───────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  category: string | null;
  brand: string;
  stock: number;
  sku: string | null;
  description: string | null;
  rating: number;
  token_bonus: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProductTag {
  id: string;
  product_id: string;
  tag: string;
}

export interface ProductSpec {
  id: string;
  product_id: string;
  value: string;
  sort_order: number;
}

export interface ProductFullSpec {
  id: string;
  product_id: string;
  group_name: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface ProductWithRelations extends Product {
  tags: string[];
  specs: ProductSpec[];
  full_specs: ProductFullSpec[];
}

export interface ProductListOptions {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "rating" | "name";
  limit?: number;
  offset?: number;
}

export interface ProductCreate {
  slug?: string;
  name: string;
  price: number;
  image?: string;
  category?: string;
  brand?: string;
  stock?: number;
  sku?: string;
  description?: string;
  token_bonus?: number;
  tags?: string[];
  specs?: { value: string; sort_order?: number }[];
  full_specs?: { group_name?: string; label: string; value: string; sort_order?: number }[];
}

export interface ProductUpdate {
  name?: string;
  price?: number;
  image?: string;
  category?: string;
  brand?: string;
  stock?: number;
  sku?: string;
  description?: string;
  rating?: number;
  token_bonus?: number;
  tags?: string[];
  specs?: { value: string; sort_order?: number }[];
  full_specs?: { group_name?: string; label: string; value: string; sort_order?: number }[];
}

// ── Product CRUD ────────────────────────────────────────────────────────

export async function listProducts(opts: ProductListOptions = {}): Promise<{
  products: Product[];
  total: number;
}> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.category) {
    conditions.push(`category = $${idx++}`);
    params.push(opts.category);
  }
  if (opts.brand) {
    conditions.push(`brand = $${idx++}`);
    params.push(opts.brand);
  }
  if (opts.minPrice != null) {
    conditions.push(`price >= $${idx++}`);
    params.push(opts.minPrice);
  }
  if (opts.maxPrice != null) {
    conditions.push(`price <= $${idx++}`);
    params.push(opts.maxPrice);
  }
  if (opts.search) {
    conditions.push(
      `to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')) @@ plainto_tsquery('simple', $${idx++})`,
    );
    params.push(opts.search);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderBy = "ORDER BY created_at DESC";
  switch (opts.sort) {
    case "price_asc":
      orderBy = "ORDER BY price ASC";
      break;
    case "price_desc":
      orderBy = "ORDER BY price DESC";
      break;
    case "newest":
      orderBy = "ORDER BY created_at DESC";
      break;
    case "rating":
      orderBy = "ORDER BY rating DESC";
      break;
    case "name":
      orderBy = "ORDER BY name ASC";
      break;
  }

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM products ${where}`,
    params,
  );

  const products = await queryAll<Product>(
    `SELECT * FROM products ${where} ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset],
  );

  return { products, total: parseInt(countResult?.count ?? "0", 10) };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return queryOne<Product>("SELECT * FROM products WHERE slug = $1", [slug]);
}

export async function getProductById(id: string): Promise<Product | null> {
  return queryOne<Product>("SELECT * FROM products WHERE id = $1", [id]);
}

export async function getProductTags(productId: string): Promise<string[]> {
  const rows = await queryAll<ProductTag>(
    "SELECT * FROM product_tags WHERE product_id = $1",
    [productId],
  );
  return rows.map((r) => r.tag);
}

export async function getProductSpecs(productId: string): Promise<ProductSpec[]> {
  return queryAll<ProductSpec>(
    "SELECT * FROM product_specs WHERE product_id = $1 ORDER BY sort_order",
    [productId],
  );
}

export async function getProductFullSpecs(productId: string): Promise<ProductFullSpec[]> {
  return queryAll<ProductFullSpec>(
    "SELECT * FROM product_full_specs WHERE product_id = $1 ORDER BY sort_order",
    [productId],
  );
}

export async function getRelatedProducts(
  productSlug: string,
  limit = 4,
): Promise<Product[]> {
  const product = await getProductBySlug(productSlug);
  if (!product || !product.category) return [];

  return queryAll<Product>(
    `SELECT * FROM products
     WHERE category = $1 AND slug != $2
     ORDER BY rating DESC
     LIMIT $3`,
    [product.category, productSlug, limit],
  );
}

export async function createProduct(data: ProductCreate): Promise<Product> {
  return transaction(async (client) => {
    const product = await clientQueryOne<Product>(
      client,
      `INSERT INTO products (slug, name, price, image, category, brand, stock, sku, description, token_bonus)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.slug,
        data.name,
        data.price,
        data.image ?? null,
        data.category ?? null,
        data.brand ?? "Operis",
        data.stock ?? 0,
        data.sku ?? null,
        data.description ?? null,
        data.token_bonus ?? null,
      ],
    );

    if (data.tags?.length) {
      for (const tag of data.tags) {
        await client.query(
          "INSERT INTO product_tags (product_id, tag) VALUES ($1, $2)",
          [product.id, tag],
        );
      }
    }

    if (data.specs?.length) {
      for (const spec of data.specs) {
        await client.query(
          "INSERT INTO product_specs (product_id, value, sort_order) VALUES ($1, $2, $3)",
          [product.id, spec.value, spec.sort_order ?? 0],
        );
      }
    }

    if (data.full_specs?.length) {
      for (const fs of data.full_specs) {
        await client.query(
          "INSERT INTO product_full_specs (product_id, group_name, label, value, sort_order) VALUES ($1, $2, $3, $4, $5)",
          [product.id, fs.group_name ?? "", fs.label, fs.value, fs.sort_order ?? 0],
        );
      }
    }

    return product;
  });
}

export async function updateProduct(id: string, data: ProductUpdate): Promise<Product | null> {
  return transaction(async (client) => {
    // Build dynamic SET clause
    const sets: string[] = [];
    const params: unknown[] = [id];
    let idx = 2;

    const fields: (keyof ProductUpdate)[] = [
      "name", "price", "image", "category", "brand",
      "stock", "sku", "description", "rating", "token_bonus",
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        params.push(data[field]);
      }
    }

    let product: Product;
    if (sets.length) {
      const result = await clientQueryOne<Product>(
        client,
        `UPDATE products SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
        params,
      );
      if (!result) return null;
      product = result;
    } else {
      const existing = await clientQueryOne<Product>(
        client,
        "SELECT * FROM products WHERE id = $1",
        [id],
      );
      if (!existing) return null;
      product = existing;
    }

    // Replace tags if provided
    if (data.tags !== undefined) {
      await client.query("DELETE FROM product_tags WHERE product_id = $1", [id]);
      for (const tag of data.tags) {
        await client.query(
          "INSERT INTO product_tags (product_id, tag) VALUES ($1, $2)",
          [id, tag],
        );
      }
    }

    // Replace specs if provided
    if (data.specs !== undefined) {
      await client.query("DELETE FROM product_specs WHERE product_id = $1", [id]);
      for (const spec of data.specs) {
        await client.query(
          "INSERT INTO product_specs (product_id, value, sort_order) VALUES ($1, $2, $3)",
          [id, spec.value, spec.sort_order ?? 0],
        );
      }
    }

    // Replace full_specs if provided
    if (data.full_specs !== undefined) {
      await client.query("DELETE FROM product_full_specs WHERE product_id = $1", [id]);
      for (const fs of data.full_specs) {
        await client.query(
          "INSERT INTO product_full_specs (product_id, group_name, label, value, sort_order) VALUES ($1, $2, $3, $4, $5)",
          [id, fs.group_name ?? "", fs.label, fs.value, fs.sort_order ?? 0],
        );
      }
    }

    return product;
  });
}

export async function deleteProduct(id: string): Promise<boolean> {
  const result = await query("DELETE FROM products WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateProductRating(productSlug: string): Promise<void> {
  await query(
    `UPDATE products SET rating = COALESCE(
       (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE product_slug = $1), 0
     ) WHERE slug = $1`,
    [productSlug],
  );
}

/**
 * Decrement stock atomically with FOR UPDATE lock
 */
export async function decrementStock(
  client: pg.PoolClient,
  productSlug: string,
  quantity: number,
): Promise<boolean> {
  const product = await clientQueryOne<Product>(
    client,
    "SELECT * FROM products WHERE slug = $1 FOR UPDATE",
    [productSlug],
  );
  if (!product || product.stock < quantity) return false;

  await client.query(
    "UPDATE products SET stock = stock - $1 WHERE slug = $2",
    [quantity, productSlug],
  );
  return true;
}

/**
 * Get distinct categories
 */
export async function getCategories(): Promise<string[]> {
  const rows = await queryAll<{ category: string }>(
    "SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category",
  );
  return rows.map((r) => r.category);
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function clientQueryOne<T extends pg.QueryResultRow>(
  client: pg.PoolClient,
  text: string,
  params?: unknown[],
): Promise<T> {
  const result = await client.query<T>(text, params);
  return result.rows[0];
}

// ── Export ───────────────────────────────────────────────────────────────

export const productsRepo = {
  listProducts,
  getProductBySlug,
  getProductById,
  getProductTags,
  getProductSpecs,
  getProductFullSpecs,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductRating,
  decrementStock,
  getCategories,
};

export default productsRepo;
