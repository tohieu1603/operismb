/**
 * Deposit Orders Repository
 * CRUD operations for deposit_orders table
 */

import { query, queryOne, queryAll } from "../connection.js";

export interface DepositOrder {
  id: string;
  user_id: string;
  order_code: string;
  token_amount: number;
  amount_vnd: number;
  status: "pending" | "completed" | "failed" | "expired" | "cancelled";
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: Date | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DepositOrderCreate {
  user_id: string;
  order_code: string;
  token_amount: number;
  amount_vnd: number;
  expires_at: Date;
}

// Pricing: 1M tokens = 500,000 VND
export const TOKEN_PRICE_VND = 500000; // VND per 1M tokens
export const TOKENS_PER_UNIT = 1000000; // 1M tokens

/**
 * Calculate VND amount from token amount
 */
export function calculateVndFromTokens(tokens: number): number {
  return Math.ceil((tokens / TOKENS_PER_UNIT) * TOKEN_PRICE_VND);
}

/**
 * Calculate token amount from VND
 */
export function calculateTokensFromVnd(vnd: number): number {
  return Math.floor((vnd / TOKEN_PRICE_VND) * TOKENS_PER_UNIT);
}

/**
 * Generate unique order code
 */
export function generateOrderCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OP${timestamp}${random}`;
}

/**
 * Create a new deposit order
 */
export async function createDepositOrder(data: DepositOrderCreate): Promise<DepositOrder> {
  const result = await queryOne<DepositOrder>(
    `INSERT INTO deposit_orders (
      user_id, order_code, token_amount, amount_vnd, expires_at
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [data.user_id, data.order_code, data.token_amount, data.amount_vnd, data.expires_at],
  );

  if (!result) {
    throw new Error("Failed to create deposit order");
  }

  return result;
}

/**
 * Get deposit order by ID
 */
export async function getDepositOrderById(id: string): Promise<DepositOrder | null> {
  return queryOne<DepositOrder>("SELECT * FROM deposit_orders WHERE id = $1", [id]);
}

/**
 * Get deposit order by order code
 */
export async function getDepositOrderByCode(orderCode: string): Promise<DepositOrder | null> {
  return queryOne<DepositOrder>("SELECT * FROM deposit_orders WHERE order_code = $1", [orderCode]);
}

/**
 * Get user's deposit orders
 */
export async function getUserDepositOrders(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<DepositOrder[]> {
  return queryAll<DepositOrder>(
    `SELECT * FROM deposit_orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
}

/**
 * Update deposit order status
 */
export async function updateDepositOrderStatus(
  id: string,
  status: DepositOrder["status"],
  paymentData?: {
    payment_method?: string;
    payment_reference?: string;
    paid_at?: Date;
  },
): Promise<DepositOrder | null> {
  const updates: string[] = ["status = $2"];
  const values: unknown[] = [id, status];
  let paramIndex = 3;

  if (paymentData?.payment_method) {
    updates.push(`payment_method = $${paramIndex++}`);
    values.push(paymentData.payment_method);
  }
  if (paymentData?.payment_reference) {
    updates.push(`payment_reference = $${paramIndex++}`);
    values.push(paymentData.payment_reference);
  }
  if (paymentData?.paid_at) {
    updates.push(`paid_at = $${paramIndex++}`);
    values.push(paymentData.paid_at);
  }

  return queryOne<DepositOrder>(
    `UPDATE deposit_orders SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values,
  );
}

/**
 * Find deposit order by payment reference (for idempotency check)
 */
export async function findByPaymentReference(
  paymentReference: string,
): Promise<DepositOrder | null> {
  return queryOne<DepositOrder>(
    "SELECT * FROM deposit_orders WHERE payment_reference = $1",
    [paymentReference],
  );
}

/**
 * Get pending orders that have expired
 */
export async function getExpiredPendingOrders(): Promise<DepositOrder[]> {
  return queryAll<DepositOrder>(
    `SELECT * FROM deposit_orders
     WHERE status = 'pending' AND expires_at < NOW()`,
    [],
  );
}

/**
 * Mark expired orders as expired
 */
export async function markExpiredOrders(): Promise<number> {
  const result = await query(
    `UPDATE deposit_orders
     SET status = 'expired'
     WHERE status = 'pending' AND expires_at < NOW()`,
    [],
  );
  return result.rowCount ?? 0;
}

/**
 * List all deposits (admin) with user info
 */
export async function listAllDeposits(
  options: { limit?: number; offset?: number; status?: string; userId?: string } = {},
): Promise<{
  deposits: (DepositOrder & { user_email: string; user_name: string })[];
  total: number;
}> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.status) {
    conditions.push(`d.status = $${paramIndex}`);
    params.push(options.status);
    paramIndex++;
  }

  if (options.userId) {
    conditions.push(`d.user_id = $${paramIndex}`);
    params.push(options.userId);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM deposit_orders d ${whereClause}`,
    params,
  );

  const deposits = await queryAll<DepositOrder & { user_email: string; user_name: string }>(
    `SELECT d.*, u.email as user_email, u.name as user_name
     FROM deposit_orders d
     JOIN users u ON d.user_id = u.id
     ${whereClause}
     ORDER BY d.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  return {
    deposits,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

export const depositsRepo = {
  createDepositOrder,
  getDepositOrderById,
  getDepositOrderByCode,
  getUserDepositOrders,
  updateDepositOrderStatus,
  findByPaymentReference,
  getExpiredPendingOrders,
  markExpiredOrders,
  listAllDeposits,
  calculateVndFromTokens,
  calculateTokensFromVnd,
  generateOrderCode,
  TOKEN_PRICE_VND,
  TOKENS_PER_UNIT,
};

export default depositsRepo;
