/**
 * Auth validators
 */

import type { ValidationResult } from "./common.validator";
import { escapeHtml } from "../utils/sanitize.util";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
  role?: "admin" | "user";
  is_active?: boolean;
  token_balance?: number;
  unique_machine?: string;
  gateway_url?: string;
  gateway_token?: string;
  gateway_hooks_token?: string;
  auth_profiles_path?: string;
}

/**
 * Validate register request
 */
export function validateRegister(body: unknown): ValidationResult<RegisterDTO> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { email, password, name } = body as Record<string, unknown>;

  // Email validation
  if (!email || typeof email !== "string") {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push("Invalid email format");
  }

  // Password validation
  if (!password || typeof password !== "string") {
    errors.push("Password is required");
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  // Name validation
  if (!name || typeof name !== "string") {
    errors.push("Name is required");
  } else {
    const trimmedName = name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
      errors.push(`Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      email: (email as string).trim().toLowerCase(),
      password: password as string,
      name: escapeHtml((name as string).trim()),
    },
  };
}

/**
 * Validate login request - generic errors for security
 */
export function validateLogin(body: unknown): ValidationResult<LoginDTO> {
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Invalid request"], data: null };
  }

  const { email, password } = body as Record<string, unknown>;

  // Generic error - don't reveal which field is wrong
  if (!email || typeof email !== "string" || !email.trim()) {
    return { valid: false, errors: ["Invalid request"], data: null };
  }
  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Invalid request"], data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      email: email.trim().toLowerCase(),
      password,
    },
  };
}

/**
 * Validate refresh token request
 */
export function validateRefresh(body: unknown): ValidationResult<RefreshTokenDTO> {
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { refreshToken } = body as Record<string, unknown>;

  if (!refreshToken || typeof refreshToken !== "string") {
    return { valid: false, errors: ["Refresh token is required"], data: null };
  }

  return {
    valid: true,
    errors: [],
    data: { refreshToken },
  };
}

/**
 * Validate change password request
 */
export function validateChangePassword(body: unknown): ValidationResult<ChangePasswordDTO> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { currentPassword, newPassword } = body as Record<string, unknown>;

  if (!currentPassword || typeof currentPassword !== "string") {
    errors.push("Current password is required");
  }

  if (!newPassword || typeof newPassword !== "string") {
    errors.push("New password is required");
  } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.push(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      currentPassword: currentPassword as string,
      newPassword: newPassword as string,
    },
  };
}

/**
 * Validate admin create user request
 */
export function validateCreateUser(body: unknown): ValidationResult<CreateUserDTO> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { email, password, name, role, is_active, token_balance, unique_machine, gateway_url, gateway_token, gateway_hooks_token, auth_profiles_path } = body as Record<string, unknown>;

  if (!email || typeof email !== "string") {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push("Invalid email format");
  }

  if (!password || typeof password !== "string") {
    errors.push("Password is required");
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (!name || typeof name !== "string") {
    errors.push("Name is required");
  } else {
    const trimmedName = name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
      errors.push(`Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters`);
    }
  }

  if (role !== undefined && role !== "admin" && role !== "user") {
    errors.push("Role must be 'admin' or 'user'");
  }

  if (token_balance !== undefined && (typeof token_balance !== "number" || token_balance < 0)) {
    errors.push("Token balance must be a non-negative number");
  }

  if (unique_machine !== undefined && (typeof unique_machine !== "string" || unique_machine.length > 255)) {
    errors.push("Unique machine must be a string (max 255 characters)");
  }

  if (is_active !== undefined && typeof is_active !== "boolean") {
    errors.push("is_active must be a boolean");
  }

  if (gateway_url !== undefined && typeof gateway_url !== "string") {
    errors.push("gateway_url must be a string");
  }

  if (gateway_token !== undefined && typeof gateway_token !== "string") {
    errors.push("gateway_token must be a string");
  }

  if (gateway_hooks_token !== undefined && typeof gateway_hooks_token !== "string") {
    errors.push("gateway_hooks_token must be a string");
  }

  if (auth_profiles_path !== undefined && typeof auth_profiles_path !== "string") {
    errors.push("auth_profiles_path must be a string");
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      email: (email as string).trim().toLowerCase(),
      password: password as string,
      name: escapeHtml((name as string).trim()),
      ...(role !== undefined && { role: role as "admin" | "user" }),
      ...(is_active !== undefined && { is_active: is_active as boolean }),
      ...(token_balance !== undefined && { token_balance: token_balance as number }),
      ...(unique_machine !== undefined && { unique_machine: (unique_machine as string).trim() }),
      ...(gateway_url !== undefined && { gateway_url: (gateway_url as string).trim() }),
      ...(gateway_token !== undefined && { gateway_token: gateway_token as string }),
      ...(gateway_hooks_token !== undefined && { gateway_hooks_token: gateway_hooks_token as string }),
      ...(auth_profiles_path !== undefined && { auth_profiles_path: (auth_profiles_path as string).trim() }),
    },
  };
}
