/**
 * Product Service - Product catalog and admin CRUD
 */

import slugify from "slugify";
import { Errors } from "../core/errors/api-error";
import { productsRepo } from "../db/index";
import type {
  Product,
  ProductWithRelations,
  ProductListOptions,
  ProductCreate,
  ProductUpdate,
} from "../db/models/products";

/** Allowed product categories */
export const PRODUCT_CATEGORIES = ["personal", "enterprise"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

class ProductService {
  async listProducts(opts: ProductListOptions = {}): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = opts.limit ?? 20;
    const page = Math.max(1, Math.floor((opts.offset ?? 0) / limit) + 1);
    const result = await productsRepo.listProducts(opts);

    return {
      products: result.products,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async getProductDetail(slug: string): Promise<ProductWithRelations> {
    const product = await productsRepo.getProductBySlug(slug);
    if (!product) throw Errors.notFound("Product");

    const [tags, specs, full_specs] = await Promise.all([
      productsRepo.getProductTags(product.id),
      productsRepo.getProductSpecs(product.id),
      productsRepo.getProductFullSpecs(product.id),
    ]);

    return { ...product, tags, specs, full_specs };
  }

  async getRelatedProducts(slug: string, limit = 4): Promise<Product[]> {
    return productsRepo.getRelatedProducts(slug, limit);
  }

  async getCategories(): Promise<string[]> {
    return [...PRODUCT_CATEGORIES];
  }

  // ── Admin CRUD ──────────────────────────────────────────────────────

  private validateCategory(category?: string): void {
    if (category && !PRODUCT_CATEGORIES.includes(category as ProductCategory)) {
      throw Errors.badRequest(`Invalid category '${category}'. Must be one of: ${PRODUCT_CATEGORIES.join(", ")}`);
    }
  }

  async createProduct(data: ProductCreate): Promise<ProductWithRelations> {
    this.validateCategory(data.category);

    // Auto-generate slug from name if not provided
    if (!data.slug) {
      data.slug = slugify(data.name, { lower: true, strict: true, locale: "vi" });
    }

    // Check slug uniqueness
    const existing = await productsRepo.getProductBySlug(data.slug!);
    if (existing) throw Errors.conflict("Product with this slug already exists");

    const product = await productsRepo.createProduct(data);

    const [tags, specs, full_specs] = await Promise.all([
      productsRepo.getProductTags(product.id),
      productsRepo.getProductSpecs(product.id),
      productsRepo.getProductFullSpecs(product.id),
    ]);

    return { ...product, tags, specs, full_specs };
  }

  async updateProduct(id: string, data: ProductUpdate): Promise<ProductWithRelations> {
    this.validateCategory(data.category);
    const product = await productsRepo.updateProduct(id, data);
    if (!product) throw Errors.notFound("Product");

    const [tags, specs, full_specs] = await Promise.all([
      productsRepo.getProductTags(product.id),
      productsRepo.getProductSpecs(product.id),
      productsRepo.getProductFullSpecs(product.id),
    ]);

    return { ...product, tags, specs, full_specs };
  }

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    const deleted = await productsRepo.deleteProduct(id);
    if (!deleted) throw Errors.notFound("Product");
    return { success: true };
  }
}

export const productService = new ProductService();
