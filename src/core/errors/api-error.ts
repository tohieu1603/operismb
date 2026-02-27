/**
 * API Error Classes and Factory
 */

import { MSG } from "../../constants/messages";

export enum ErrorCode {
  // Auth errors
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED",
  FORBIDDEN = "FORBIDDEN",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // Business logic errors
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",

  // System errors
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly publicMessage: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode?: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode ?? this.getDefaultStatusCode(code);
    this.details = details;
    this.publicMessage = message;
  }

  private getDefaultStatusCode(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.INVALID_CREDENTIALS:
      case ErrorCode.INVALID_TOKEN:
      case ErrorCode.TOKEN_EXPIRED:
        return 401;
      case ErrorCode.ACCOUNT_DEACTIVATED:
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.CONFLICT:
        return 409;
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.INSUFFICIENT_BALANCE:
        return 400;
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      case ErrorCode.INTERNAL_ERROR:
      default:
        return 500;
    }
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Error factory for common error types
 */
export const Errors = {
  // Auth errors
  unauthorized: (message = MSG.AUTH_REQUIRED) =>
    new ApiError(ErrorCode.UNAUTHORIZED, message),

  invalidCredentials: () =>
    new ApiError(ErrorCode.INVALID_CREDENTIALS, MSG.INVALID_CREDENTIALS),

  invalidToken: () => new ApiError(ErrorCode.INVALID_TOKEN, MSG.INVALID_TOKEN),

  tokenExpired: () => new ApiError(ErrorCode.TOKEN_EXPIRED, MSG.TOKEN_EXPIRED),

  accountDeactivated: () =>
    new ApiError(ErrorCode.ACCOUNT_DEACTIVATED, MSG.ACCOUNT_DEACTIVATED),

  forbidden: (message = MSG.ACCESS_DENIED) => new ApiError(ErrorCode.FORBIDDEN, message),

  // Resource errors
  notFound: (resource: string) => new ApiError(ErrorCode.NOT_FOUND, MSG.NOT_FOUND(resource)),

  conflict: (message: string) => new ApiError(ErrorCode.CONFLICT, message),

  // Validation errors
  validation: (message: string) => new ApiError(ErrorCode.VALIDATION_ERROR, message),

  badRequest: (message: string) => new ApiError(ErrorCode.INVALID_INPUT, message),

  // Business logic errors
  insufficientBalance: (current: number, required: number) =>
    new ApiError(
      ErrorCode.INSUFFICIENT_BALANCE,
      MSG.INSUFFICIENT_BALANCE(current, required),
      400,
      {
        current,
        required,
      },
    ),

  // System errors
  serviceUnavailable: (service: string) =>
    new ApiError(ErrorCode.SERVICE_UNAVAILABLE, MSG.SERVICE_UNAVAILABLE(service)),

  internal: (message = MSG.INTERNAL_ERROR) => new ApiError(ErrorCode.INTERNAL_ERROR, message),
};
