/**
 * User Service - User management (admin)
 */

import { usersRepo } from "../db/index.js";
import { Errors } from "../core/errors/api-error.js";
import { sanitizeUser, sanitizeUsers } from "../utils/sanitize.util.js";
import { hashPassword } from "../utils/password.util.js";
import type { SafeUser } from "../core/types/entities.js";

export interface PaginatedUsers {
  users: SafeUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class UserService {
  async list(
    page: number,
    limit: number,
    search?: string,
    role?: string,
    status?: string,
  ): Promise<PaginatedUsers> {
    const result = await usersRepo.listUsers({
      limit,
      offset: (page - 1) * limit,
      search,
      role,
      status,
    });

    return {
      users: sanitizeUsers(result.users),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async getById(id: string): Promise<SafeUser> {
    const user = await usersRepo.getUserById(id);
    if (!user) throw Errors.notFound("User");
    return sanitizeUser(user);
  }

  async update(id: string, data: Record<string, unknown>): Promise<SafeUser> {
    const existing = await usersRepo.getUserById(id);
    if (!existing) throw Errors.notFound("User");

    // Hash password if provided
    if (data.password) {
      data.password_hash = await hashPassword(data.password as string);
      delete data.password;
    }

    const user = await usersRepo.updateUser(id, data);
    if (!user) throw Errors.notFound("User");
    return sanitizeUser(user);
  }

  async delete(id: string): Promise<void> {
    const deleted = await usersRepo.deleteUser(id);
    if (!deleted) throw Errors.notFound("User");
  }

  async topup(id: string, amount: number): Promise<SafeUser> {
    const user = await usersRepo.updateTokenBalance(id, amount);
    if (!user) throw Errors.notFound("User");
    return sanitizeUser(user);
  }
}

export const userService = new UserService();
