/**
 * Refresh Token Repository
 * CRUD operations for refresh_tokens table (TypeORM)
 */

import { LessThan } from "typeorm";
import { AppDataSource } from "../data-source.js";
import { RefreshTokenEntity } from "../entities/refresh-token.entity.js";
import type { RefreshToken, RefreshTokenCreate } from "./types.js";

function getRepo() {
  return AppDataSource.getRepository(RefreshTokenEntity);
}

/** Create a new refresh token record */
export async function createRefreshToken(data: RefreshTokenCreate): Promise<RefreshToken> {
  const entity = getRepo().create({
    user_id: data.user_id,
    token_hash: data.token_hash,
    family: data.family,
    expires_at: data.expires_at,
    user_agent: data.user_agent ?? null,
    ip_address: data.ip_address ?? null,
  });
  const saved = await getRepo().save(entity);
  return saved as unknown as RefreshToken;
}

/** Find a refresh token by its hash */
export async function getByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
  const result = await getRepo().findOneBy({ token_hash: tokenHash });
  return (result as unknown as RefreshToken) ?? null;
}

/** Revoke a single refresh token */
export async function revokeToken(id: string): Promise<void> {
  await getRepo().update({ id }, { is_revoked: true, revoked_at: new Date() });
}

/** Revoke ALL tokens in a family (reuse detection) */
export async function revokeFamily(family: string): Promise<void> {
  await getRepo().update(
    { family, is_revoked: false },
    { is_revoked: true, revoked_at: new Date() },
  );
}

/** Revoke all refresh tokens for a user (password change, deactivation) */
export async function revokeAllForUser(userId: string): Promise<void> {
  await getRepo().update(
    { user_id: userId, is_revoked: false },
    { is_revoked: true, revoked_at: new Date() },
  );
}

/** Delete expired tokens (cleanup) */
export async function deleteExpired(): Promise<number> {
  const result = await getRepo().delete({ expires_at: LessThan(new Date()) });
  return result.affected ?? 0;
}

export default {
  createRefreshToken,
  getByTokenHash,
  revokeToken,
  revokeFamily,
  revokeAllForUser,
  deleteExpired,
};
