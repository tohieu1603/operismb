/**
 * Sanitize utilities - remove sensitive fields from entities
 * Single source of truth to avoid code duplication
 */

import type { OperisUser, OperisApiKey, SafeUser, SafeApiKey } from "../core/types/entities.js";

/**
 * Escape HTML special characters to prevent XSS
 * Used for user-supplied text fields before storing
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function sanitizeUser(user: OperisUser): SafeUser {
  const { password_hash: _, ...safe } = user;
  return safe;
}

export function sanitizeApiKey(key: OperisApiKey): SafeApiKey {
  const { key_hash: _, ...safe } = key;
  return safe;
}

export function sanitizeUsers(users: OperisUser[]): SafeUser[] {
  return users.map(sanitizeUser);
}

export function sanitizeApiKeys(keys: OperisApiKey[]): SafeApiKey[] {
  return keys.map(sanitizeApiKey);
}
