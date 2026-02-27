/**
 * Common validators
 */

import { Errors } from "../core/errors/api-error";
import { MSG } from "../constants/messages";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validation result type for middleware pattern
 */
export type ValidationResult<T> =
  | { valid: true; errors: []; data: T }
  | { valid: false; errors: string[]; data: null };

export interface PaginationDTO {
  page: number;
  limit: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  type?: string;
}

export const CommonValidator = {
  validateUUID(value: unknown, fieldName = "ID"): string {
    if (!value || typeof value !== "string" || !UUID_REGEX.test(value)) {
      throw Errors.validation(MSG.INVALID_UUID(fieldName));
    }
    return value;
  },

  validatePagination(query: unknown, maxLimit = 100): PaginationDTO {
    const params = (query || {}) as Record<string, unknown>;

    const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(String(params.limit ?? "20"), 10) || 20));

    return { page, limit };
  },

  validatePositiveNumber(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || value <= 0 || !Number.isFinite(value)) {
      throw Errors.validation(MSG.MUST_BE_POSITIVE(fieldName));
    }
    return value;
  },

  validateString(value: unknown, fieldName: string, minLen = 1, maxLen = 1000): string {
    if (!value || typeof value !== "string") {
      throw Errors.validation(MSG.FIELD_REQUIRED(fieldName));
    }
    const trimmed = value.trim();
    if (trimmed.length < minLen || trimmed.length > maxLen) {
      throw Errors.validation(MSG.FIELD_LENGTH(fieldName, minLen, maxLen));
    }
    return trimmed;
  },

  validateOptionalString(value: unknown, minLen = 1, maxLen = 1000): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw Errors.validation(MSG.INVALID_STRING);
    }
    const trimmed = value.trim();
    if (trimmed.length > 0 && (trimmed.length < minLen || trimmed.length > maxLen)) {
      throw Errors.validation(MSG.FIELD_LENGTH("Chuỗi", minLen, maxLen));
    }
    return trimmed.length > 0 ? trimmed : undefined;
  },

  validateEnum<T extends string>(value: unknown, validValues: readonly T[], fieldName: string): T {
    if (!validValues.includes(value as T)) {
      throw Errors.validation(MSG.INVALID_ENUM(fieldName));
    }
    return value as T;
  },

  validateBoolean(value: unknown, fieldName: string): boolean {
    if (typeof value !== "boolean") {
      throw Errors.validation(MSG.MUST_BE_BOOLEAN(fieldName));
    }
    return value;
  },
};
