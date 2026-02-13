/**
 * Orders Repository
 * CRUD for orders + order_items tables
 */

import { query, queryOne, queryAll } from "../connection";
import type pg from "pg";

// ── Types ───────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  user_id: string;
  order_code: string;
  deposit_order_id: string | null;
  total_amount: number;
  status: OrderStatus;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_note: string | null;
  payment_method: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type OrderStatus = "pending" | "processing" | "shipping" | "delivered" | "cancelled";

export interface OrderItem {
  id: string;
  order_id: string;
  product_slug: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  created_at: Date;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface OrderCreate {
  user_id: string;
  order_code: string;
  deposit_order_id?: string;
  total_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_note?: string;
  payment_method?: string;
}

export interface OrderItemCreate {
  order_id: string;
  product_slug: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

// ── Order CRUD ──────────────────────────────────────────────────────────

export async function createOrder(
  client: pg.PoolClient,
  data: OrderCreate,
): Promise<Order> {
  const result = await client.query<Order>(
    `INSERT INTO orders (user_id, order_code, deposit_order_id, total_amount,
       shipping_name, shipping_phone, shipping_address, shipping_note, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.user_id,
      data.order_code,
      data.deposit_order_id ?? null,
      data.total_amount,
      data.shipping_name,
      data.shipping_phone,
      data.shipping_address,
      data.shipping_note ?? null,
      data.payment_method ?? null,
    ],
  );
  return result.rows[0];
}

export async function createOrderItem(
  client: pg.PoolClient,
  data: OrderItemCreate,
): Promise<OrderItem> {
  const result = await client.query<OrderItem>(
    `INSERT INTO order_items (order_id, product_slug, name, price, quantity, image)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.order_id, data.product_slug, data.name, data.price, data.quantity, data.image ?? null],
  );
  return result.rows[0];
}

export async function getOrderById(id: string): Promise<Order | null> {
  return queryOne<Order>("SELECT * FROM orders WHERE id = $1", [id]);
}

export async function getOrderByCode(orderCode: string): Promise<Order | null> {
  return queryOne<Order>("SELECT * FROM orders WHERE order_code = $1", [orderCode]);
}

export async function getOrderByDepositOrderId(depositOrderId: string): Promise<Order | null> {
  return queryOne<Order>(
    "SELECT * FROM orders WHERE deposit_order_id = $1",
    [depositOrderId],
  );
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  return queryAll<OrderItem>(
    "SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at",
    [orderId],
  );
}

export async function getUserOrders(
  userId: string,
  limit = 20,
  offset = 0,
  status?: OrderStatus,
): Promise<{ orders: Order[]; total: number }> {
  const conditions = ["user_id = $1"];
  const params: unknown[] = [userId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM orders ${where}`,
    params,
  );

  const orders = await queryAll<Order>(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset],
  );

  return { orders, total: parseInt(countResult?.count ?? "0", 10) };
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order | null> {
  return queryOne<Order>(
    "UPDATE orders SET status = $2 WHERE id = $1 RETURNING *",
    [id, status],
  );
}

export async function updateOrderDepositId(
  id: string,
  depositOrderId: string,
): Promise<Order | null> {
  return queryOne<Order>(
    "UPDATE orders SET deposit_order_id = $2 WHERE id = $1 RETURNING *",
    [id, depositOrderId],
  );
}

/**
 * List all orders (admin) with user info via JOIN
 */
export async function listAllOrders(
  options: {
    limit?: number;
    offset?: number;
    status?: OrderStatus;
    userId?: string;
    search?: string;
  } = {},
): Promise<{ orders: (Order & { user_email: string; user_name: string; items: OrderItem[] })[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (options.status) {
    conditions.push(`o.status = $${idx++}`);
    params.push(options.status);
  }
  if (options.userId) {
    conditions.push(`o.user_id = $${idx++}`);
    params.push(options.userId);
  }
  if (options.search) {
    conditions.push(`(o.order_code ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${options.search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM orders o LEFT JOIN users u ON o.user_id = u.id ${where}`,
    params,
  );

  const rows = await queryAll<Order & { user_email: string; user_name: string }>(
    `SELECT o.*, u.email as user_email, u.name as user_name
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset],
  );

  // Fetch items for each order
  const orders = [];
  for (const row of rows) {
    const items = await getOrderItems(row.id);
    orders.push({ ...row, items });
  }

  return { orders, total: parseInt(countResult?.count ?? "0", 10) };
}

// ── Export ───────────────────────────────────────────────────────────────

export const ordersRepo = {
  createOrder,
  createOrderItem,
  getOrderById,
  getOrderByCode,
  getOrderByDepositOrderId,
  getOrderItems,
  getUserOrders,
  updateOrderStatus,
  updateOrderDepositId,
  listAllOrders,
};

export default ordersRepo;
