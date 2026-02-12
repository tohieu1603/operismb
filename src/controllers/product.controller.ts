/**
 * Product Controller - Product catalog & admin CRUD
 */

import type { Request, Response, NextFunction } from "express";
import { productService } from "../services/product.service.js";
import type { ProductListOptions } from "../db/models/products.js";

// ── Public ──────────────────────────────────────────────────────────────

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const opts: ProductListOptions = {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      brand: req.query.brand as string | undefined,
      sort: req.query.sort as ProductListOptions["sort"],
      limit: Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100),
      offset: parseInt(String(req.query.offset ?? "0"), 10),
    };

    if (req.query.minPrice) opts.minPrice = parseInt(String(req.query.minPrice), 10);
    if (req.query.maxPrice) opts.maxPrice = parseInt(String(req.query.maxPrice), 10);

    const result = await productService.listProducts(opts);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getProductDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.getProductDetail(req.params.slug);
    res.json(product);
  } catch (error) {
    next(error);
  }
}

export async function getRelatedProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(String(req.query.limit ?? "4"), 10);
    const products = await productService.getRelatedProducts(req.params.slug, limit);
    res.json(products);
  } catch (error) {
    next(error);
  }
}

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await productService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
}

// ── Admin ───────────────────────────────────────────────────────────────

export async function adminCreateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await productService.deleteProduct(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
