/**
 * Auth validators
 */

import type { ValidationResult } from "./common.validator.js";

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
      name: (name as string).trim(),
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
