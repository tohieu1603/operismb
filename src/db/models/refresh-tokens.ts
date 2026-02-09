/**
 * Refresh Token Repository
 * CRUD operations for refresh_tokens table
 */

import { query, queryOne } from "../connection.js";
import type { RefreshToken, RefreshTokenCreate } from "./types.js";

/** Create a new refresh token record */
export async function createRefreshToken(data: RefreshTokenCreate): Promise<RefreshToken> {
  const result = await queryOne<RefreshToken>(
    `INSERT INTO refresh_tokens (
      user_id, token_hash, family, expires_at, user_agent, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      data.user_id,
      data.token_hash,
      data.family,
      data.expires_at,
      data.user_agent ?? null,
      data.ip_address ?? null,
    ],
  );
  if (!result) throw new Error("Failed to create refresh token");
  return result;
}

/** Find a refresh token by its hash */
export async function getByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
  return queryOne<RefreshToken>(
    "SELECT * FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash],
  );
}

/** Revoke a single refresh token */
export async function revokeToken(id: string): Promise<void> {
  await query(
    "UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE id = $1",
    [id],
  );
}

/** Revoke ALL tokens in a family (reuse detection) */
export async function revokeFamily(family: string): Promise<void> {
  await query(
    "UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE family = $1 AND is_revoked = false",
    [family],
  );
}

/** Revoke all refresh tokens for a user (password change, deactivation) */
export async function revokeAllForUser(userId: string): Promise<void> {
  await query(
    "UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE user_id = $1 AND is_revoked = false",
    [userId],
  );
}

/** Delete expired tokens (cleanup) */
export async function deleteExpired(): Promise<number> {
  const result = await query("DELETE FROM refresh_tokens WHERE expires_at < NOW()");
  return result.rowCount ?? 0;
}

export default {
  createRefreshToken,
  getByTokenHash,
  revokeToken,
  revokeFamily,
  revokeAllForUser,
  deleteExpired,
};
