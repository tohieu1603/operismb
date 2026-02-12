/**
 * Deposit Orders Repository
 * CRUD operations for deposit_orders table
 */

import { AppDataSource } from "../data-source.js";
import { DepositOrderEntity } from "../entities/deposit-order.entity.js";

export type DepositType = "token" | "order";

export interface DepositOrder {
  id: string;
  user_id: string;
  order_code: string;
  type: DepositType;
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
  type: DepositType;
  token_amount: number;
  amount_vnd: number;
  expires_at: Date;
}

// Pricing: 1M tokens = 500,000 VND
export const TOKEN_PRICE_VND = 500000; // VND per 1M tokens
export const TOKENS_PER_UNIT = 1000000; // 1M tokens

function getRepo() {
  return AppDataSource.getRepository(DepositOrderEntity);
}

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
export function generateOrderCode(prefix: "OP" | "OD" = "OP"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Create a new deposit order
 */
export async function createDepositOrder(data: DepositOrderCreate): Promise<DepositOrder> {
  const entity = getRepo().create({
    user_id: data.user_id,
    order_code: data.order_code,
    token_amount: data.token_amount,
    amount_vnd: data.amount_vnd,
    expires_at: data.expires_at,
  });

  const result = await getRepo().save(entity);
  return result as unknown as DepositOrder;
}

/**
 * Get deposit order by ID
 */
export async function getDepositOrderById(id: string): Promise<DepositOrder | null> {
  const result = await getRepo().findOneBy({ id });
  return result as unknown as DepositOrder | null;
}

/**
 * Get deposit order scoped to user (anti-IDOR: query with both id + user_id)
 */
export async function getDepositOrderByIdAndUser(id: string, userId: string): Promise<DepositOrder | null> {
  const result = await getRepo().findOneBy({ id, user_id: userId });
  return result as unknown as DepositOrder | null;
}

/**
 * Get deposit order by order code
 */
export async function getDepositOrderByCode(orderCode: string): Promise<DepositOrder | null> {
  const result = await getRepo().findOneBy({ order_code: orderCode });
  return result as unknown as DepositOrder | null;
}

/**
 * Get user's deposit orders
 */
export async function getUserDepositOrders(
  userId: string,
  limit = 20,
  offset = 0,
  type?: DepositType,
): Promise<DepositOrder[]> {
  const results = await getRepo().find({
    where: { user_id: userId },
    order: { created_at: "DESC" },
    take: limit,
    skip: offset,
  });

  return results as unknown as DepositOrder[];
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
  const updateData: Partial<DepositOrderEntity> = { status };

  if (paymentData?.payment_method) {
    updateData.payment_method = paymentData.payment_method;
  }
  if (paymentData?.payment_reference) {
    updateData.payment_reference = paymentData.payment_reference;
  }
  if (paymentData?.paid_at) {
    updateData.paid_at = paymentData.paid_at;
  }

  await getRepo().update({ id }, updateData);
  const result = await getRepo().findOneBy({ id });
  return result as unknown as DepositOrder | null;
}

/**
 * Find deposit order by payment reference (for idempotency check)
 */
export async function findByPaymentReference(
  paymentReference: string,
): Promise<DepositOrder | null> {
  const result = await getRepo().findOneBy({ payment_reference: paymentReference });
  return result as unknown as DepositOrder | null;
}

/**
 * Get pending orders that have expired
 */
export async function getExpiredPendingOrders(): Promise<DepositOrder[]> {
  const results = await getRepo()
    .createQueryBuilder("d")
    .where("d.status = 'pending'")
    .andWhere("d.expires_at < NOW()")
    .getMany();

  return results as unknown as DepositOrder[];
}

/**
 * Mark expired orders as expired
 */
export async function markExpiredOrders(): Promise<number> {
  const result = await getRepo()
    .createQueryBuilder()
    .update()
    .set({ status: "expired" })
    .where("status = 'pending' AND expires_at < NOW()")
    .execute();

  return result.affected ?? 0;
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

  const qb = getRepo()
    .createQueryBuilder("d")
    .leftJoin("users", "u", "d.user_id = u.id")
    .addSelect("u.email", "user_email")
    .addSelect("u.name", "user_name");

  if (options.status) {
    qb.andWhere("d.status = :status", { status: options.status });
  }

  if (options.userId) {
    qb.andWhere("d.user_id = :userId", { userId: options.userId });
  }

  const countQb = getRepo().createQueryBuilder("d");
  if (options.status) {
    countQb.andWhere("d.status = :status", { status: options.status });
  }
  if (options.userId) {
    countQb.andWhere("d.user_id = :userId", { userId: options.userId });
  }

  const total = await countQb.getCount();

  const rawResults = await qb
    .orderBy("d.created_at", "DESC")
    .limit(limit)
    .offset(offset)
    .getRawMany();

  const deposits = rawResults.map((row) => ({
    id: row.d_id,
    user_id: row.d_user_id,
    order_code: row.d_order_code,
    type: row.d_type as DepositType,
    token_amount: row.d_token_amount,
    amount_vnd: row.d_amount_vnd,
    status: row.d_status,
    payment_method: row.d_payment_method,
    payment_reference: row.d_payment_reference,
    paid_at: row.d_paid_at,
    expires_at: row.d_expires_at,
    created_at: row.d_created_at,
    updated_at: row.d_updated_at,
    user_email: row.user_email,
    user_name: row.user_name,
  }));

  return {
    deposits,
    total,
  };
}

export const depositsRepo = {
  createDepositOrder,
  getDepositOrderById,
  getDepositOrderByIdAndUser,
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
