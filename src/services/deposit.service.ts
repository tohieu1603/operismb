/**
 * Deposit Service - Handle token deposits with SePay integration
 * Pricing: 1,000,000 tokens = 500,000 VND
 */

import { Errors } from "../core/errors/api-error.js";
import { depositsRepo, usersRepo } from "../db/index.js";
import { tokenService } from "./token.service.js";
import type { DepositOrder } from "../db/models/deposits.js";

// SePay configuration
const SEPAY_BANK_CODE = process.env.SEPAY_BANK_CODE || "BIDV";
const SEPAY_BANK_ACCOUNT = process.env.SEPAY_BANK_ACCOUNT || "96247CISI1";
const SEPAY_ACCOUNT_NAME = process.env.SEPAY_ACCOUNT_NAME || "TO TRONG HIEU";
const DEPOSIT_EXPIRY_MINUTES = 10; // Max 10 minutes per order

export interface CreateDepositInput {
  tokenAmount: number;
}

export interface DepositOrderResponse {
  id: string;
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

    // Validate token amount (minimum 100,000 tokens)
    if (input.tokenAmount < 100000) {
      throw Errors.badRequest("Minimum deposit is 100,000 tokens");
    }

    // Check for existing pending order (prevent spam)
    const existingOrders = await depositsRepo.getUserDepositOrders(userId, 10, 0);
    const pendingOrder = existingOrders.find(
      (o) => o.status === "pending" && new Date(o.expires_at) > new Date(),
    );

    if (pendingOrder) {
      // Return existing pending order instead of creating new one
      return this.formatDepositResponse(pendingOrder);
    }

    // Mark old expired orders
    await depositsRepo.markExpiredOrders();

    // Calculate VND amount
    const amountVnd = depositsRepo.calculateVndFromTokens(input.tokenAmount);

    // Generate order code
    const orderCode = depositsRepo.generateOrderCode();

    // Set expiry (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + DEPOSIT_EXPIRY_MINUTES);

    // Create deposit order
    const order = await depositsRepo.createDepositOrder({
      user_id: userId,
      order_code: orderCode,
      token_amount: input.tokenAmount,
      amount_vnd: amountVnd,
      expires_at: expiresAt,
    });

    return this.formatDepositResponse(order);
  }

  /**
   * Get current pending order for user (for retry payment)
   */
  async getPendingOrder(userId: string): Promise<DepositOrderResponse | null> {
    const orders = await depositsRepo.getUserDepositOrders(userId, 1, 0);
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
    const order = await depositsRepo.getDepositOrderById(orderId);
    if (!order) throw Errors.notFound("Deposit order");
    if (order.user_id !== userId) throw Errors.forbidden("Not your deposit order");
    if (order.status !== "pending") {
      throw Errors.badRequest("Only pending orders can be cancelled");
    }

    await depositsRepo.updateDepositOrderStatus(orderId, "expired");
    return { success: true };
  }

  /**
   * Get deposit order by ID
   */
  async getDeposit(userId: string, depositId: string): Promise<DepositOrderResponse> {
    const order = await depositsRepo.getDepositOrderById(depositId);
    if (!order) throw Errors.notFound("Deposit order");
    if (order.user_id !== userId) throw Errors.forbidden("Not your deposit order");

    return this.formatDepositResponse(order);
  }

  /**
   * Get user's deposit history
   */
  async getDepositHistory(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ orders: DepositOrderResponse[]; total: number }> {
    const orders = await depositsRepo.getUserDepositOrders(userId, limit, offset);
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
   * Process SePay webhook callback
   */
  async processPaymentWebhook(data: {
    transferType: string;
    transferAmount: number;
    content: string;
    referenceCode: string;
    transactionDate: string;
  }): Promise<{ success: boolean; orderId?: string }> {
    // Extract order code from transfer content
    const orderCodeMatch = data.content.match(/OP[A-Z0-9]+/);
    if (!orderCodeMatch) {
      return { success: false };
    }

    const orderCode = orderCodeMatch[0];
    const order = await depositsRepo.getDepositOrderByCode(orderCode);

    if (!order) {
      return { success: false };
    }

    if (order.status !== "pending") {
      return { success: true, orderId: order.id };
    }

    // Verify amount matches
    if (data.transferAmount < order.amount_vnd) {
      return { success: false };
    }

    // Update order status
    await depositsRepo.updateDepositOrderStatus(order.id, "completed", {
      payment_method: "bank_transfer",
      payment_reference: data.referenceCode,
      paid_at: new Date(data.transactionDate),
    });

    // Add tokens to user
    await tokenService.credit(order.user_id, order.token_amount, `Deposit: ${orderCode}`, order.id);

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

  /**
   * Get pricing info with packages
   */
  getPricingInfo(): {
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
  } {
    const packages = [
      { id: "starter", name: "Starter", tokens: 100000, bonus: 0, popular: false },
      { id: "basic", name: "Basic", tokens: 500000, bonus: 0, popular: false },
      { id: "standard", name: "Standard", tokens: 1000000, bonus: 50000, popular: true },
      { id: "pro", name: "Pro", tokens: 2000000, bonus: 150000, popular: false },
      { id: "business", name: "Business", tokens: 5000000, bonus: 500000, popular: false },
      { id: "enterprise", name: "Enterprise", tokens: 10000000, bonus: 1500000, popular: false },
    ];

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
}

export const depositService = new DepositService();
