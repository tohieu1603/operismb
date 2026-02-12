/**
 * Product Routes
 * ==============
 * Sản phẩm: danh sách, chi tiết, admin CRUD
 */

import { Router } from "express";
import {
  listProducts,
  getProductDetail,
  getRelatedProducts,
  getCategories,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
} from "../controllers/product.controller";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware";

export const productRoutes = Router();

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Danh sách sản phẩm
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: integer }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: integer }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [price_asc, price_desc, newest, rating, name] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm
 *     security: []
 */
productRoutes.get("/", listProducts);

/**
 * @swagger
 * /products/categories:
 *   get:
 *     tags: [Products]
 *     summary: Danh sách danh mục
 *     responses:
 *       200:
 *         description: Mảng string các danh mục
 *     security: []
 */
productRoutes.get("/categories", getCategories);

/**
 * @swagger
 * /products/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Chi tiết sản phẩm
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sản phẩm + tags + specs + full_specs
 *       404:
 *         description: Không tìm thấy
 *     security: []
 */
productRoutes.get("/:slug", getProductDetail);

/**
 * @swagger
 * /products/{slug}/related:
 *   get:
 *     tags: [Products]
 *     summary: Sản phẩm liên quan
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 4 }
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm cùng danh mục
 *     security: []
 */
productRoutes.get("/:slug/related", getRelatedProducts);

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /products/admin:
 *   post:
 *     tags: [Products - Admin]
 *     summary: Tạo sản phẩm mới
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               slug: { type: string }
 *               name: { type: string }
 *               price: { type: integer }
 *               image: { type: string }
 *               category: { type: string }
 *               brand: { type: string }
 *               stock: { type: integer }
 *               sku: { type: string }
 *               description: { type: string }
 *               token_bonus: { type: integer }
 *               tags: { type: array, items: { type: string } }
 *               specs: { type: array, items: { type: object, properties: { value: { type: string }, sort_order: { type: integer } } } }
 *               full_specs: { type: array, items: { type: object, properties: { group_name: { type: string }, label: { type: string }, value: { type: string }, sort_order: { type: integer } } } }
 *     responses:
 *       201:
 *         description: Sản phẩm đã tạo
 *       409:
 *         description: Slug đã tồn tại
 */
productRoutes.post("/admin", authMiddleware, adminMiddleware, adminCreateProduct);

/**
 * @swagger
 * /products/admin/{id}:
 *   patch:
 *     tags: [Products - Admin]
 *     summary: Cập nhật sản phẩm
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               price: { type: integer }
 *               image: { type: string }
 *               category: { type: string }
 *               brand: { type: string }
 *               stock: { type: integer }
 *               sku: { type: string }
 *               description: { type: string }
 *               token_bonus: { type: integer }
 *               tags: { type: array, items: { type: string } }
 *               specs: { type: array }
 *               full_specs: { type: array }
 *     responses:
 *       200:
 *         description: Sản phẩm đã cập nhật
 *       404:
 *         description: Không tìm thấy
 */
productRoutes.patch("/admin/:id", authMiddleware, adminMiddleware, adminUpdateProduct);

/**
 * @swagger
 * /products/admin/{id}:
 *   delete:
 *     tags: [Products - Admin]
 *     summary: Xóa sản phẩm
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Đã xóa
 *       404:
 *         description: Không tìm thấy
 */
productRoutes.delete("/admin/:id", authMiddleware, adminMiddleware, adminDeleteProduct);

export default productRoutes;
