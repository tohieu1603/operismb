/**
 * User Controller (Admin)
 * Handles HTTP requests for user management
 */

import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";

class UserController {
  async list(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await userService.list(page, limit, search, role, status);
    res.json({
      users: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const user = await userService.getById(id);
    res.json(user);
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const user = await userService.update(id, req.body);
    res.json(user);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await userService.delete(id);
    res.json({ success: true });
  }

  async topup(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const { amount } = req.body;
    const user = await userService.topup(id, amount);
    res.json(user);
  }
}

export const userController = new UserController();
