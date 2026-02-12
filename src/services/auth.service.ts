/**
 * Auth Service - Authentication business logic with refresh token rotation
 */

import { usersRepo, refreshTokensRepo } from "../db/index";
import { Errors } from "../core/errors/api-error";
import { sanitizeUser } from "../utils/sanitize.util";
import { hashPassword, verifyPassword } from "../utils/password.util";
import {
  generateTokens,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiryDate,
} from "../utils/jwt.util";
import type { SafeUser } from "../core/types/entities";

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthMeta {
  userAgent?: string;
  ip?: string;
}

class AuthService {
  /** Store refresh token hash in DB */
  private async storeRefreshToken(
    refreshToken: string,
    userId: string,
    family: string,
    meta?: AuthMeta,
  ): Promise<void> {
    await refreshTokensRepo.createRefreshToken({
      user_id: userId,
      token_hash: hashToken(refreshToken),
      family,
      expires_at: getRefreshTokenExpiryDate(),
      user_agent: meta?.userAgent,
      ip_address: meta?.ip,
    });
  }

  async register(email: string, password: string, name: string, meta?: AuthMeta): Promise<AuthResult> {
    const existing = await usersRepo.getUserByEmail(email);
    if (existing) throw Errors.conflict("Registration failed");

    const user = await usersRepo.createUser({
      email,
      password_hash: await hashPassword(password),
      name,
    });

    const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role });

    // Store refresh token in DB
    const claims = verifyRefreshToken(tokens.refreshToken);
    if (claims) {
      await this.storeRefreshToken(tokens.refreshToken, user.id, claims.family, meta);
    }

    return { user: sanitizeUser(user), ...tokens };
  }

  async login(email: string, password: string, meta?: AuthMeta): Promise<AuthResult> {
    const user = await usersRepo.getUserByEmail(email);
    if (!user) throw Errors.invalidCredentials();
    if (!user.is_active) throw Errors.accountDeactivated();

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) throw Errors.invalidCredentials();

    await usersRepo.updateUser(user.id, { last_active_at: new Date() });
    const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role });

    // Store refresh token in DB
    const claims = verifyRefreshToken(tokens.refreshToken);
    if (claims) {
      await this.storeRefreshToken(tokens.refreshToken, user.id, claims.family, meta);
    }

    return { user: sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    // 1. Verify JWT signature
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) throw Errors.invalidToken();

    // 2. Lookup in DB by hash
    const tokenHash = hashToken(refreshToken);
    const storedToken = await refreshTokensRepo.getByTokenHash(tokenHash);

    if (!storedToken) {
      // Token not in DB — could be old stateless token or already deleted
      throw Errors.invalidToken();
    }

    // 3. Reuse detection — if token was already revoked, revoke entire family
    if (storedToken.is_revoked) {
      await refreshTokensRepo.revokeFamily(storedToken.family);
      throw Errors.invalidToken();
    }

    // 4. Check expiry (defense in depth)
    if (new Date(storedToken.expires_at) < new Date()) {
      throw Errors.invalidToken();
    }

    // 5. Check user still valid
    const user = await usersRepo.getUserById(payload.userId);
    if (!user || !user.is_active) throw Errors.invalidToken();

    // 6. Revoke old token
    await refreshTokensRepo.revokeToken(storedToken.id);

    // 7. Issue new pair with same family
    const newTokens = generateTokens(
      { userId: user.id, email: user.email, role: user.role },
      { family: storedToken.family },
    );

    // 8. Store new refresh token
    const newClaims = verifyRefreshToken(newTokens.refreshToken);
    if (newClaims) {
      await this.storeRefreshToken(newTokens.refreshToken, user.id, newClaims.family);
    }

    return newTokens;
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    const tokenHash = hashToken(refreshToken);
    const storedToken = await refreshTokensRepo.getByTokenHash(tokenHash);
    if (storedToken && !storedToken.is_revoked) {
      await refreshTokensRepo.revokeToken(storedToken.id);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) throw Errors.invalidCredentials();

    const newHash = await hashPassword(newPassword);
    await usersRepo.updateUser(userId, { password_hash: newHash });

    // Revoke all refresh tokens on password change (security)
    await refreshTokensRepo.revokeAllForUser(userId);
  }

  /** Admin: create a new user account */
  async createUserByAdmin(params: {
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
  }): Promise<SafeUser> {
    const existing = await usersRepo.getUserByEmail(params.email);
    if (existing) throw Errors.conflict("Email already exists");

    if (params.unique_machine) {
      const machineUser = await usersRepo.getUserByMachine(params.unique_machine);
      if (machineUser) throw Errors.conflict("Machine ID already in use");
    }

    const user = await usersRepo.createUser({
      email: params.email,
      password_hash: await hashPassword(params.password),
      name: params.name,
      role: params.role ?? "user",
      token_balance: params.token_balance ?? 1000000,
      is_active: params.is_active,
      unique_machine: params.unique_machine,
      gateway_url: params.gateway_url,
      gateway_token: params.gateway_token,
      gateway_hooks_token: params.gateway_hooks_token,
      auth_profiles_path: params.auth_profiles_path,
    });

    return sanitizeUser(user);
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    return sanitizeUser(user);
  }

  /** Update gateway_url, gateway_token, and gateway_hooks_token for the authenticated user */
  async updateGateway(
    userId: string,
    data: { gateway_url?: string | null; gateway_token?: string | null; gateway_hooks_token?: string | null },
  ): Promise<SafeUser> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");

    const updates: Record<string, string | null | undefined> = {};
    if (data.gateway_url !== undefined) updates.gateway_url = data.gateway_url;
    if (data.gateway_token !== undefined) updates.gateway_token = data.gateway_token;
    if (data.gateway_hooks_token !== undefined) updates.gateway_hooks_token = data.gateway_hooks_token;

    const updated = await usersRepo.updateUser(userId, updates);
    if (!updated) throw Errors.notFound("User");

    return sanitizeUser(updated);
  }
}

export const authService = new AuthService();
