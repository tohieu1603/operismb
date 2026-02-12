/**
 * Auth Controller
 * Handles HTTP requests for authentication
 */

import type { Request, Response } from "express";
import { authService } from "../services/auth.service";
import type { RegisterDTO, LoginDTO, ChangePasswordDTO, CreateUserDTO } from "../validators/auth.validator";
import {
  syncAuthProfiles,
  clearAuthProfiles,
  pushAuthProfilesToGateway,
  clearAuthProfilesViaGateway,
} from "../utils/auth-profiles-sync.util";
import { provisionTunnel, type ProvisionResult } from "../services/cloudflare-tunnel.service";
import { verifyRefreshToken } from "../utils/jwt.util";
import { getUserById } from "../db/models/users";

/** Provision CF tunnel, return result or null on failure (never throws) */
async function safeProvisionTunnel(userId: string, email: string): Promise<ProvisionResult | null> {
  try {
    return await provisionTunnel(userId, email);
  } catch (err: any) {
    console.error("[auth] Auto-provision tunnel failed:", err.message);
    return null;
  }
}

class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const { email, password, name } = req.body as RegisterDTO;
    const meta = { userAgent: req.headers["user-agent"], ip: req.ip };
    const result = await authService.register(email, password, name, meta);
    // Sync OAuth tokens + push to gateway (register auto-logs in, same as login)
    syncAuthProfiles(result.user.auth_profiles_path);
    pushAuthProfilesToGateway(result.user.id);
    // Auto-provision CF tunnel → return token in response for Electron to start cloudflared
    const tunnel = await safeProvisionTunnel(result.user.id, email);
    res.status(201).json({ ...result, tunnel });
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as LoginDTO;
    const meta = { userAgent: req.headers["user-agent"], ip: req.ip };
    const result = await authService.login(email, password, meta);
    // Sync OAuth tokens: local filesystem + push to remote gateway (non-blocking)
    syncAuthProfiles(result.user.auth_profiles_path);
    pushAuthProfilesToGateway(result.user.id);
    // Auto-provision CF tunnel (idempotent) → return token in response
    const tunnel = await safeProvisionTunnel(result.user.id, email);
    res.json({ ...result, tunnel });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.json(result);
  }

  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body ?? {};
    // Use userId from access token (auth middleware) as primary; fallback to refreshToken claims
    const userId = req.user?.userId
      ?? (refreshToken ? verifyRefreshToken(refreshToken)?.userId : null)
      ?? null;

    await authService.logout(refreshToken);

    // Clear auth-profiles: local filesystem + push empty to remote gateway
    let authProfilesPath: string | null = null;
    if (userId) {
      const user = await getUserById(userId);
      authProfilesPath = user?.auth_profiles_path ?? null;
      clearAuthProfilesViaGateway(userId);
    }
    clearAuthProfiles(authProfilesPath);
    res.json({ success: true });
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const { currentPassword, newPassword } = req.body as ChangePasswordDTO;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ success: true });
  }

  async createUser(req: Request, res: Response): Promise<void> {
    const data = req.body as CreateUserDTO;
    const user = await authService.createUserByAdmin(data);
    res.status(201).json(user);
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const result = await authService.getMe(req.user!.userId);
    res.json(result);
  }

  async updateGateway(req: Request, res: Response): Promise<void> {
    const { gateway_url, gateway_token, gateway_hooks_token } = req.body;
    const result = await authService.updateGateway(req.user!.userId, {
      gateway_url,
      gateway_token,
      gateway_hooks_token,
    });
    res.json(result);
  }
}

export const authController = new AuthController();
