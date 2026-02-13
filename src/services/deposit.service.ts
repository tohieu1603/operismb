/**
 * Deposit Service - Handle token deposits with SePay integration
 * Pricing: 1,000,000 tokens = 500,000 VND
 */

import { Errors } from "../core/errors/api-error.js";
import { depositsRepo, usersRepo, settingsRepo } from "../db/index.js";
import { AppDataSource } from "../db/data-source.js";
import { creditTokensWithClient } from "../db/models/token-transactions.js";
import { tokenService } from "./token.service.js";
import type { DepositOrder, DepositType } from "../db/models/deposits.js";

// SePay configuration
const SEPAY_BANK_CODE = process.env.SEPAY_BANK_CODE || "BIDV";
const SEPAY_BANK_ACCOUNT = process.env.SEPAY_BANK_ACCOUNT || "96247CISI1";
const SEPAY_ACCOUNT_NAME = process.env.SEPAY_ACCOUNT_NAME || "TO TRONG HIEU";
const DEPOSIT_EXPIRY_MINUTES = 30; // 30 minutes for bank transfers

export interface CreateDepositInput {
  type: DepositType;
  tokenAmount?: number; // Required for type=token
  amountVnd?: number; // Required for type=order
}

export interface DepositOrderResponse {
  id: string;
  type: DepositType;
  orderCode: string;
  tokenAmount: number;
  amountVnd: number;
  status: string;
  paymentInfo: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferContent: string;
    qrCodeUrl: string;
  };
  expiresAt: string;
  createdAt: string;
}

export interface TokenHistoryItem {
  id: string;
  type: "credit" | "debit" | "adjustment";
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

class DepositService {
  /**
   * Create a new deposit order (or return existing pending order)
   * Prevents spam by returning existing pending order if one exists
   */
  async createDeposit(userId: string, input: CreateDepositInput): Promise<DepositOrderResponse> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    if (!user.is_active) throw Errors.accountDeactivated();

    const isToken = input.type === "token";
    let tokenAmount: number;
    let amountVnd: number;

    if (isToken) {
      if (!input.tokenAmount) throw Errors.badRequest("tokenAmount is required for token deposits");
      if (input.tokenAmount < 100000) throw Errors.badRequest("Minimum deposit is 100,000 tokens");
      tokenAmount = input.tokenAmount;
      amountVnd = depositsRepo.calculateVndFromTokens(tokenAmount);
    } else {
      if (!input.amountVnd) throw Errors.badRequest("amountVnd is required for order payments");
      if (input.amountVnd < 1000) throw Errors.badRequest("Minimum amount is 1,000 VND");
      tokenAmount = 0;
      amountVnd = input.amountVnd;
    }

    // Check for existing pending order of same type (prevent spam)
    const existingOrders = await depositsRepo.getUserDepositOrders(userId, 10, 0);
    const pendingOrder = existingOrders.find(
      (o) => o.type === input.type && o.status === "pending" && new Date(o.expires_at) > new Date(),
    );

    if (pendingOrder) {
      return this.formatDepositResponse(pendingOrder);
    }

    // Mark old expired orders
    await depositsRepo.markExpiredOrders();

    // Generate order code with prefix based on type
    const prefix = isToken ? "OP" : "OD";
    const orderCode = depositsRepo.generateOrderCode(prefix);

    // Set expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + DEPOSIT_EXPIRY_MINUTES);

    // Create deposit order
    const order = await depositsRepo.createDepositOrder({
      user_id: userId,
      order_code: orderCode,
      type: input.type,
      token_amount: tokenAmount,
      amount_vnd: amountVnd,
      expires_at: expiresAt,
    });

    return this.formatDepositResponse(order);
  }

  /**
   * Get current pending order for user (for retry payment)
   */
  async getPendingOrder(userId: string, type?: DepositType): Promise<DepositOrderResponse | null> {
    const orders = await depositsRepo.getUserDepositOrders(userId, 10, 0, type);
    const pendingOrder = orders.find(
      (o) => o.status === "pending" && new Date(o.expires_at) > new Date(),
    );

    if (!pendingOrder) return null;
    return this.formatDepositResponse(pendingOrder);
  }

  /**
   * Cancel pending order (allows creating new one)
   */
  async cancelPendingOrder(userId: string, orderId: string): Promise<{ success: boolean }> {
    // Anti-IDOR: query scoped to userId
    const order = await depositsRepo.getDepositOrderByIdAndUser(orderId, userId);
    if (!order) throw Errors.notFound("Deposit order");
    if (order.status !== "pending") {
      throw Errors.badRequest("Only pending orders can be cancelled");
    }

    await depositsRepo.updateDepositOrderStatus(orderId, "cancelled");
    return { success: true };
  }

  /**
   * Get deposit order by ID (scoped to user)
   */
  async getDeposit(userId: string, depositId: string): Promise<DepositOrderResponse> {
    // Anti-IDOR: query scoped to userId
    const order = await depositsRepo.getDepositOrderByIdAndUser(depositId, userId);
    if (!order) throw Errors.notFound("Deposit order");

    return this.formatDepositResponse(order);
  }

  /**
   * Get user's deposit history
   */
  async getDepositHistory(
    userId: string,
    limit = 20,
    offset = 0,
    type?: DepositType,
  ): Promise<{ orders: DepositOrderResponse[]; total: number }> {
    const orders = await depositsRepo.getUserDepositOrders(userId, limit, offset, type);
    return {
      orders: orders.map((o) => this.formatDepositResponse(o)),
      total: orders.length,
    };
  }

  /**
   * Get user's token transaction history
   */
  async getTokenHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ transactions: TokenHistoryItem[]; total: number }> {
    const transactions = await tokenService.getTransactionHistory(userId, limit, offset);
    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type as "credit" | "debit" | "adjustment",
        amount: t.amount,
        balanceAfter: t.balance_after,
        description: t.description,
        createdAt: t.created_at.toISOString(),
      })),
      total: transactions.length,
    };
  }

  /**
   * Process SePay webhook callback.
   * - Idempotent: duplicate referenceCode is a no-op.
   * - Atomic: order update + token credit in a single DB transaction.
   * - Late-payment tolerant: expired orders are reactivated.
   */
  async processPaymentWebhook(data: {
    transferType: string;
    transferAmount: number;
    content: string;
    referenceCode: string;
    transactionDate: string;
  }): Promise<{ success: boolean; orderId?: string }> {
    // Extract order code from transfer content (OP = token deposit, OD = order payment)
    const orderCodeMatch = data.content.match(/(OP|OD)[A-Z0-9]+/);
    if (!orderCodeMatch) {
      console.warn("[deposit] Webhook: no order code found in content:", data.content);
      return { success: false };
    }

    const orderCode = orderCodeMatch[0];

    // Idempotency check: if this referenceCode was already processed, skip
    if (data.referenceCode) {
      const existing = await depositsRepo.findByPaymentReference(data.referenceCode);
      if (existing) {
        console.log(`[deposit] Webhook: duplicate referenceCode ${data.referenceCode}, skipping`);
        return { success: true, orderId: existing.id };
      }
    }

    const order = await depositsRepo.getDepositOrderByCode(orderCode);

    if (!order) {
      console.warn(`[deposit] Webhook: order not found for code ${orderCode}`);
      return { success: false };
    }

    // Already completed → idempotent success
    if (order.status === "completed") {
      return { success: true, orderId: order.id };
    }

    // Only process pending or expired orders (late payment recovery)
    if (order.status !== "pending" && order.status !== "expired") {
      console.warn(`[deposit] Webhook: order ${order.id} has status ${order.status}, cannot process`);
      return { success: false };
    }

    // Verify amount matches
    if (data.transferAmount < order.amount_vnd) {
      console.warn(
        `[deposit] Webhook: amount mismatch for order ${order.id}: expected ${order.amount_vnd}, got ${data.transferAmount}`,
      );
      return { success: false };
    }

    // Atomic: update order + credit tokens in single transaction
    await AppDataSource.transaction(async (manager) => {
      // Update order status to completed
      await manager.query(
        `UPDATE deposit_orders
         SET status = 'completed',
             payment_method = $2,
             payment_reference = $3,
             paid_at = $4
         WHERE id = $1`,
        [order.id, "bank_transfer", data.referenceCode, new Date(data.transactionDate)],
      );

      // Credit tokens to user
      await creditTokensWithClient(
        manager,
        order.user_id,
        order.token_amount,
        `Deposit: ${orderCode}`,
        order.id,
      );
    });

    const logMsg =
      order.type === "token"
        ? `${order.token_amount} tokens credited to user ${order.user_id}`
        : `order payment ${order.amount_vnd} VND completed for user ${order.user_id}`;
    console.log(`[deposit] Webhook: order ${order.id} completed — ${logMsg}`);

    // For order payments, update the linked order status
    if (order.type === "order") {
      try {
        const { orderService } = await import("./order.service.js");
        await orderService.onPaymentCompleted(order.id);
      } catch (err) {
        console.error("[deposit] Failed to update order after payment:", err);
      }
    }

    return { success: true, orderId: order.id };
  }

  /**
   * Admin: Update user token balance
   */
  async adminUpdateTokens(
    adminUserId: string,
    targetUserId: string,
    amount: number,
    reason: string,
  ): Promise<{ newBalance: number }> {
    const admin = await usersRepo.getUserById(adminUserId);
    if (!admin || admin.role !== "admin") {
      throw Errors.forbidden("Admin access required");
    }

    const user = await usersRepo.getUserById(targetUserId);
    if (!user) throw Errors.notFound("User");

    if (amount > 0) {
      await tokenService.credit(targetUserId, amount, `Admin: ${reason}`, `admin:${adminUserId}`);
    } else if (amount < 0) {
      await tokenService.debit(
        targetUserId,
        Math.abs(amount),
        `Admin: ${reason}`,
        `admin:${adminUserId}`,
      );
    }

    const updatedUser = await usersRepo.getUserById(targetUserId);
    return { newBalance: updatedUser?.token_balance ?? 0 };
  }

  /**
   * Format deposit order for API response
   */
  private formatDepositResponse(order: DepositOrder): DepositOrderResponse {
    const now = new Date();
    const expiresAt = new Date(order.expires_at);
    const isExpired = expiresAt <= now;

    // Auto-update status if expired
    const status = order.status === "pending" && isExpired ? "expired" : order.status;

    return {
      id: order.id,
      type: order.type,
      orderCode: order.order_code,
      tokenAmount: order.token_amount,
      amountVnd: order.amount_vnd,
      status,
      paymentInfo: {
        bankName: SEPAY_BANK_CODE,
        accountNumber: SEPAY_BANK_ACCOUNT,
        accountName: SEPAY_ACCOUNT_NAME,
        transferContent: order.order_code,
        qrCodeUrl: this.generateQrCodeUrl(order),
      },
      expiresAt: order.expires_at.toISOString(),
      createdAt: order.created_at.toISOString(),
    };
  }

  /**
   * Generate SePay QR code URL
   * Format: https://qr.sepay.vn/img?acc={BANK_ACCOUNT}&bank={BANK_CODE}&amount={AMOUNT}&des={DESCRIPTION}
   */
  private generateQrCodeUrl(order: DepositOrder): string {
    const params = new URLSearchParams({
      acc: SEPAY_BANK_ACCOUNT,
      bank: SEPAY_BANK_CODE,
      amount: order.amount_vnd.toString(),
      des: order.order_code,
    });

    return `https://qr.sepay.vn/img?${params.toString()}`;
  }

  /**
   * Admin: Get all deposits across all users
   */
  async getAllDeposits(
    page: number,
    limit: number,
    status?: string,
    userId?: string,
  ): Promise<{
    deposits: (DepositOrderResponse & { user_email: string; user_name: string })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await depositsRepo.listAllDeposits({
      limit,
      offset: (page - 1) * limit,
      status,
      userId,
    });

    return {
      deposits: result.deposits.map((d) => ({
        ...this.formatDepositResponse(d),
        user_email: d.user_email,
        user_name: d.user_name,
      })),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  // ── Pricing ────────────────────────────────────────────────────────────

  /** Default packages used when no custom pricing is stored in settings */
  private static DEFAULT_PACKAGES = [
    { id: "starter", name: "Starter", tokens: 100000, bonus: 0, popular: false },
    { id: "basic", name: "Basic", tokens: 500000, bonus: 0, popular: false },
    { id: "standard", name: "Standard", tokens: 1000000, bonus: 50000, popular: true },
    { id: "pro", name: "Pro", tokens: 2000000, bonus: 150000, popular: false },
    { id: "business", name: "Business", tokens: 5000000, bonus: 500000, popular: false },
    { id: "enterprise", name: "Enterprise", tokens: 10000000, bonus: 1500000, popular: false },
  ];

  /**
   * Get pricing info with packages (reads from settings, falls back to defaults)
   */
  async getPricingInfo(): Promise<{
    pricePerMillion: number;
    currency: string;
    minimumTokens: number;
    minimumVnd: number;
    packages: Array<{
      id: string;
      name: string;
      tokens: number;
      priceVnd: number;
      bonus: number;
      popular: boolean;
    }>;
  }> {
    // Try to load custom pricing from settings
    const stored = await settingsRepo.getSetting("deposit_pricing");
    let packages = DepositService.DEFAULT_PACKAGES;

    if (stored) {
      try {
        packages = JSON.parse(stored);
      } catch {
        // Fall back to defaults on invalid JSON
      }
    }

    return {
      pricePerMillion: depositsRepo.TOKEN_PRICE_VND,
      currency: "VND",
      minimumTokens: 100000,
      minimumVnd: depositsRepo.calculateVndFromTokens(100000),
      packages: packages.map((pkg) => ({
        ...pkg,
        priceVnd: depositsRepo.calculateVndFromTokens(pkg.tokens),
      })),
    };
  }

  /**
   * Admin: Update deposit pricing packages
   */
  async updatePricing(
    packages: Array<{
      id: string;
      name: string;
      tokens: number;
      bonus: number;
      popular: boolean;
    }>,
  ) {
    // Validate packages
    for (const pkg of packages) {
      if (!pkg.id || !pkg.name) throw Errors.badRequest("Each package must have id and name");
      if (pkg.tokens <= 0) throw Errors.badRequest(`Package '${pkg.id}': tokens must be > 0`);
      if (pkg.bonus < 0) throw Errors.badRequest(`Package '${pkg.id}': bonus must be >= 0`);
    }

    // Check for duplicate IDs
    const ids = packages.map((p) => p.id);
    if (new Set(ids).size !== ids.length) {
      throw Errors.badRequest("Package IDs must be unique");
    }

    await settingsRepo.setSetting("deposit_pricing", JSON.stringify(packages));
    return this.getPricingInfo();
  }
}

export const depositService = new DepositService();
