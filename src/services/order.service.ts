/**
 * Order Service - Checkout, history, tracking, cancel
 * Integrates with deposit system for SePay payments
 */

import { Errors } from "../core/errors/api-error";
import { transaction, depositsRepo, ordersRepo, settingsRepo } from "../db/index";
import type { OrderWithItems, OrderStatus } from "../db/models/orders";

export interface CheckoutInput {
  items: { product_slug: string; quantity: number }[];
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_note?: string;
}

export interface CheckoutResult {
  order: OrderWithItems;
  payment: {
    depositOrderId: string;
    orderCode: string;
    amountVnd: number;
    paymentInfo: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      transferContent: string;
      qrCodeUrl: string;
    };
    expiresAt: string;
  };
}

const SEPAY_BANK_CODE = process.env.SEPAY_BANK_CODE || "BIDV";
const SEPAY_BANK_ACCOUNT = process.env.SEPAY_BANK_ACCOUNT || "96247CISI1";
const SEPAY_ACCOUNT_NAME = process.env.SEPAY_ACCOUNT_NAME || "TO TRONG HIEU";
const ORDER_EXPIRY_MINUTES = 30;

class OrderService {
  async checkout(userId: string, input: CheckoutInput): Promise<CheckoutResult> {
    if (!input.items.length) throw Errors.badRequest("Cart is empty");

    // Get shipping fee from settings
    const shippingFeeSetting = await settingsRepo.getSetting("shipping_fee_vnd");
    const shippingFee = shippingFeeSetting ? parseInt(shippingFeeSetting, 10) : 30000;

    return transaction(async (client) => {
      // Validate products & calculate total
      let subtotal = 0;
      const resolvedItems: {
        product_slug: string;
        name: string;
        price: number;
        quantity: number;
        image: string | null;
      }[] = [];

      for (const item of input.items) {
        // Lock product row for stock check
        const result = await client.query<{
          slug: string;
          name: string;
          price: number;
          stock: number;
          image: string | null;
        }>(
          "SELECT slug, name, price, stock, image FROM products WHERE slug = $1 FOR UPDATE",
          [item.product_slug],
        );
        const product = result.rows[0];
        if (!product) throw Errors.notFound(`Product ${item.product_slug}`);
        if (product.stock < item.quantity) {
          throw Errors.badRequest(`Insufficient stock for ${product.name} (available: ${product.stock})`);
        }

        // Decrement stock
        await client.query(
          "UPDATE products SET stock = stock - $1 WHERE slug = $2",
          [item.quantity, item.product_slug],
        );

        subtotal += product.price * item.quantity;
        resolvedItems.push({
          product_slug: item.product_slug,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          image: product.image,
        });
      }

      const totalAmount = subtotal + shippingFee;

      // Generate order code (OD prefix for deposit integration)
      const orderCode = depositsRepo.generateOrderCode("OD");

      // Create deposit order for payment
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + ORDER_EXPIRY_MINUTES);

      const depositResult = await client.query(
        `INSERT INTO deposit_orders (user_id, order_code, type, token_amount, amount_vnd, expires_at)
         VALUES ($1, $2, 'order', 0, $3, $4)
         RETURNING *`,
        [userId, orderCode, totalAmount, expiresAt],
      );
      const depositOrder = depositResult.rows[0];

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, order_code, deposit_order_id, total_amount,
           shipping_name, shipping_phone, shipping_address, shipping_note, payment_method, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'bank_transfer', $9)
         RETURNING *`,
        [
          userId,
          orderCode,
          depositOrder.id,
          totalAmount,
          input.shipping_name,
          input.shipping_phone,
          input.shipping_address,
          input.shipping_note ?? null,
          expiresAt,
        ],
      );
      const order = orderResult.rows[0];

      // Create order items (snapshot)
      const items = [];
      for (const item of resolvedItems) {
        const itemResult = await client.query(
          `INSERT INTO order_items (order_id, product_slug, name, price, quantity, image)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [order.id, item.product_slug, item.name, item.price, item.quantity, item.image],
        );
        items.push(itemResult.rows[0]);
      }

      // Build QR URL
      const qrParams = new URLSearchParams({
        acc: SEPAY_BANK_ACCOUNT,
        bank: SEPAY_BANK_CODE,
        amount: totalAmount.toString(),
        des: orderCode,
      });

      return {
        order: { ...order, items },
        payment: {
          depositOrderId: depositOrder.id,
          orderCode,
          amountVnd: totalAmount,
          paymentInfo: {
            bankName: SEPAY_BANK_CODE,
            accountNumber: SEPAY_BANK_ACCOUNT,
            accountName: SEPAY_ACCOUNT_NAME,
            transferContent: orderCode,
            qrCodeUrl: `https://qr.sepay.vn/img?${qrParams.toString()}`,
          },
          expiresAt: expiresAt.toISOString(),
        },
      };
    });
  }

  /**
   * Lazy-expire a single pending order if its deposit has expired.
   * Cancels order + restores stock. Returns actual status.
   */
  private async resolveOrderStatus(order: { id: string; status: string; expires_at: Date | null; deposit_order_id: string | null }): Promise<string> {
    if (order.status !== "pending" || !order.expires_at) return order.status;
    if (new Date(order.expires_at) > new Date()) return order.status;

    // Expired — cancel order + restore stock
    await ordersRepo.updateOrderStatus(order.id, "cancelled");
    if (order.deposit_order_id) {
      await depositsRepo.updateDepositOrderStatus(order.deposit_order_id, "expired");
    }

    const { query: dbQuery } = await import("../db/connection.js");
    const items = await ordersRepo.getOrderItems(order.id);
    for (const item of items) {
      await dbQuery(
        "UPDATE products SET stock = stock + $1 WHERE slug = $2",
        [item.quantity, item.product_slug],
      );
    }

    return "cancelled";
  }

  /**
   * List orders — minimal info for list view
   */
  async getUserOrders(
    userId: string,
    limit = 20,
    offset = 0,
    status?: OrderStatus,
  ) {
    const result = await ordersRepo.getUserOrders(userId, limit, offset, status);

    const orders = [];
    for (const order of result.orders) {
      const resolvedStatus = await this.resolveOrderStatus(order);
      const items = await ordersRepo.getOrderItems(order.id);
      orders.push({
        id: order.id,
        order_code: order.order_code,
        status: resolvedStatus,
        total_amount: order.total_amount,
        created_at: order.created_at,
        expires_at: order.expires_at,
        item_count: items.reduce((sum, i) => sum + i.quantity, 0),
        items: items.map((i) => ({
          product_slug: i.product_slug,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
        })),
      });
    }

    return { orders, total: result.total };
  }

  /**
   * Order detail — full info + payment QR if pending
   */
  async getOrderDetail(userId: string, orderId: string) {
    const order = await ordersRepo.getOrderById(orderId);
    if (!order) throw Errors.notFound("Order");
    if (order.user_id !== userId) throw Errors.forbidden("Not your order");

    const resolvedStatus = await this.resolveOrderStatus(order);
    const items = await ordersRepo.getOrderItems(order.id);

    const detail: Record<string, unknown> = {
      ...order,
      status: resolvedStatus,
      items,
    };

    // Include payment info if still pending
    if (resolvedStatus === "pending" && order.deposit_order_id) {
      const deposit = await depositsRepo.getDepositOrderById(order.deposit_order_id);
      if (deposit && deposit.status === "pending") {
        const qrParams = new URLSearchParams({
          acc: SEPAY_BANK_ACCOUNT,
          bank: SEPAY_BANK_CODE,
          amount: order.total_amount.toString(),
          des: order.order_code,
        });

        detail.payment = {
          orderCode: order.order_code,
          amountVnd: order.total_amount,
          paymentInfo: {
            bankName: SEPAY_BANK_CODE,
            accountNumber: SEPAY_BANK_ACCOUNT,
            accountName: SEPAY_ACCOUNT_NAME,
            transferContent: order.order_code,
            qrCodeUrl: `https://qr.sepay.vn/img?${qrParams.toString()}`,
          },
          expiresAt: deposit.expires_at,
        };
      }
    }

    return detail;
  }

  async cancelOrder(userId: string, orderId: string): Promise<{ success: boolean }> {
    const order = await ordersRepo.getOrderById(orderId);
    if (!order) throw Errors.notFound("Order");
    if (order.user_id !== userId) throw Errors.forbidden("Not your order");
    if (order.status !== "pending") {
      throw Errors.badRequest("Only pending orders can be cancelled");
    }

    await ordersRepo.updateOrderStatus(orderId, "cancelled");

    // Cancel linked deposit order
    if (order.deposit_order_id) {
      await depositsRepo.updateDepositOrderStatus(order.deposit_order_id, "cancelled");
    }

    // Restore stock
    const { query: dbQuery } = await import("../db/connection.js");
    const items = await ordersRepo.getOrderItems(orderId);
    for (const item of items) {
      await dbQuery(
        "UPDATE products SET stock = stock + $1 WHERE slug = $2",
        [item.quantity, item.product_slug],
      );
    }

    return { success: true };
  }

  /**
   * Called by deposit webhook when OD payment is confirmed
   */
  async onPaymentCompleted(depositOrderId: string): Promise<void> {
    const order = await ordersRepo.getOrderByDepositOrderId(depositOrderId);
    if (!order) {
      console.warn(`[order] No order found for deposit ${depositOrderId}`);
      return;
    }

    if (order.status !== "pending") {
      console.log(`[order] Order ${order.id} already has status ${order.status}, skipping`);
      return;
    }

    await ordersRepo.updateOrderStatus(order.id, "processing");
    console.log(`[order] Order ${order.id} marked as processing after payment`);
  }
}

export const orderService = new OrderService();
