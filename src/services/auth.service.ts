/**
 * Auth Service - Authentication business logic
 */

import { usersRepo } from "../db/index.js";
import { Errors } from "../core/errors/api-error.js";
import { sanitizeUser } from "../utils/sanitize.util.js";
import { hashPassword, verifyPassword } from "../utils/password.util.js";
import { generateTokens, verifyRefreshToken } from "../utils/jwt.util.js";
import type { SafeUser } from "../core/types/entities.js";

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

class AuthService {
  async register(email: string, password: string, name: string): Promise<AuthResult> {
    console.log("[auth] Register attempt:", { email, name });
    console.log("[auth] DB env vars:", {
      DB_HOST: process.env.DB_HOST || "NOT SET",
      DB_PORT: process.env.DB_PORT || "NOT SET",
      DB_NAME: process.env.DB_NAME || "NOT SET",
      DB_USER: process.env.DB_USER || "NOT SET",
      DB_PASSWORD: process.env.DB_PASSWORD ? "***SET***" : "NOT SET",
      DB_PASSWORD_TYPE: typeof process.env.DB_PASSWORD,
    });

    try {
      console.log("[auth] Checking existing user...");
      const existing = await usersRepo.getUserByEmail(email);
      if (existing) {
        throw Errors.conflict("Registration failed");
      }

      console.log("[auth] Creating user...");
      const user = await usersRepo.createUser({
        email,
        password_hash: await hashPassword(password),
        name,
      });

      console.log("[auth] User created:", user.id);
      const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role });
      return { user: sanitizeUser(user), ...tokens };
    } catch (error) {
      console.error("[auth] Register error:", error);
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await usersRepo.getUserByEmail(email);
    if (!user) throw Errors.invalidCredentials();
    if (!user.is_active) throw Errors.accountDeactivated();

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) throw Errors.invalidCredentials();

    await usersRepo.updateUser(user.id, { last_active_at: new Date() });
    const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role });
    return { user: sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) throw Errors.invalidToken();

    const user = await usersRepo.getUserById(payload.userId);
    if (!user) throw Errors.invalidToken();
    if (!user.is_active) throw Errors.accountDeactivated();

    return generateTokens({ userId: user.id, email: user.email, role: user.role });
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await usersRepo.getUserById(userId);
    if (!user) throw Errors.notFound("User");
    return sanitizeUser(user);
  }
}

export const authService = new AuthService();
