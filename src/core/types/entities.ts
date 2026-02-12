/**
 * Operis API Entity Types
 */

import type {
  User,
  UserApiKey,
  TokenTransaction as DbTokenTransaction,
} from "../../db/models/types";

// Re-export TokenTransaction from db types
export type TokenTransaction = DbTokenTransaction;

// Alias for Operis User (with password_hash)
export type OperisUser = User;

// Alias for Operis API Key (with key_hash)
export type OperisApiKey = UserApiKey;

// Safe User (without password_hash)
export type SafeUser = Omit<User, "password_hash">;

// Safe API Key (without key_hash)
export type SafeApiKey = Omit<UserApiKey, "key_hash">;
