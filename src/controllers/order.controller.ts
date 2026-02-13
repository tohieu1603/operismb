/**
 * Order Controller - Checkout, history, detail, cancel
 */

import type { Request, Response, NextFunction } from "express";
import { orderService } from "../services/order.service.js";
import type { OrderStatus } from "../db/models/orders.js";

export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await orderService.checkout(userId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUserOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const status = req.query.status as OrderStatus | undefined;

    const result = await orderService.getUserOrders(userId, limit, offset, status);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getOrderDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const order = await orderService.getOrderDetail(userId, req.params.id);
    res.json(order);
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await orderService.cancelOrder(userId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ── Admin ───────────────────────────────────────────────────────────────

export async function adminGetAllOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10), 100);
    const status = req.query.status as OrderStatus | undefined;
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await orderService.adminGetAllOrders(page, limit, status, userId, search);
    res.json({
      orders: result.orders,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: "status is required", code: "BAD_REQUEST" });
      return;
    }

    const validStatuses: OrderStatus[] = ["processing", "shipping", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, code: "BAD_REQUEST" });
      return;
    }

    const order = await orderService.adminUpdateOrderStatus(req.params.id, status);
    res.json(order);
  } catch (error) {
    next(error);
  }
}
