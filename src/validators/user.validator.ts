/**
 * User validators
 */

import { Errors } from "../core/errors/api-error";
import { MSG } from "../constants/messages";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["admin", "user"] as const;

export interface ListUsersDTO {
  page: number;
  limit: number;
  search?: string;
  role?: string;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "user";
  is_active?: boolean;
  token_balance?: number;
}

export interface TopupDTO {
  amount: number;
}

export const UserValidator = {
  validateId(id: unknown): string {
    if (!id || typeof id !== "string" || !UUID_REGEX.test(id)) {
      throw Errors.validation(MSG.INVALID_USER_ID);
    }
    return id;
  },

  validateListParams(query: unknown): ListUsersDTO {
    const params = (query || {}) as Record<string, unknown>;

    const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(params.limit ?? "20"), 10) || 20));

    const result: ListUsersDTO = { page, limit };

    if (params.search && typeof params.search === "string") {
      const search = params.search.trim();
      if (search.length > 0 && search.length <= 100) {
        result.search = search;
      }
    }

    if (params.role && typeof params.role === "string") {
      if (VALID_ROLES.includes(params.role as "admin" | "user")) {
        result.role = params.role;
      }
    }

    return result;
  },

  validateUpdate(body: unknown): UpdateUserDTO {
    if (!body || typeof body !== "object") {
      throw Errors.validation(MSG.REQUEST_BODY_REQUIRED);
    }

    const data = body as Record<string, unknown>;
    const result: UpdateUserDTO = {};

    // Name
    if (data.name !== undefined) {
      if (typeof data.name !== "string" || data.name.trim().length < 2) {
        throw Errors.validation(MSG.NAME_MIN_LENGTH);
      }
      result.name = data.name.trim();
    }

    // Email
    if (data.email !== undefined) {
      if (typeof data.email !== "string" || !EMAIL_REGEX.test(data.email.trim())) {
        throw Errors.validation(MSG.EMAIL_INVALID);
      }
      result.email = data.email.trim().toLowerCase();
    }

    // Password
    if (data.password !== undefined) {
      if (typeof data.password !== "string" || data.password.length < 8) {
        throw Errors.validation(MSG.PASSWORD_MIN_LENGTH);
      }
      result.password = data.password;
    }

    // Role
    if (data.role !== undefined) {
      if (!VALID_ROLES.includes(data.role as "admin" | "user")) {
        throw Errors.validation(MSG.ROLE_INVALID);
      }
      result.role = data.role as "admin" | "user";
    }

    // Is active
    if (data.is_active !== undefined) {
      if (typeof data.is_active !== "boolean") {
        throw Errors.validation(MSG.IS_ACTIVE_INVALID);
      }
      result.is_active = data.is_active;
    }

    // Token balance
    if (data.token_balance !== undefined) {
      if (typeof data.token_balance !== "number" || data.token_balance < 0) {
        throw Errors.validation(MSG.TOKEN_BALANCE_INVALID);
      }
      result.token_balance = data.token_balance;
    }

    if (Object.keys(result).length === 0) {
      throw Errors.validation(MSG.NO_FIELDS_TO_UPDATE);
    }

    return result;
  },

  validateTopup(body: unknown): TopupDTO {
    if (!body || typeof body !== "object") {
      throw Errors.validation(MSG.REQUEST_BODY_REQUIRED);
    }

    const { amount } = body as Record<string, unknown>;

    if (typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
      throw Errors.validation(MSG.AMOUNT_MUST_BE_POSITIVE);
    }

    return { amount };
  },
};
