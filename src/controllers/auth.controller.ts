/**
 * Auth Controller
 * Handles HTTP requests for authentication
 */

import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import type { RegisterDTO, LoginDTO } from "../validators/auth.validator.js";
import {
  syncAuthProfiles,
  clearAuthProfiles,
  pushAuthProfilesToGateway,
  clearAuthProfilesViaGateway,
} from "../utils/auth-profiles-sync.util.js";
import { verifyRefreshToken } from "../utils/jwt.util.js";
import { getUserById } from "../db/models/users.js";

class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const { email, password, name } = req.body as RegisterDTO;
    const meta = { userAgent: req.headers["user-agent"], ip: req.ip };
    const result = await authService.register(email, password, name, meta);
    res.status(201).json(result);
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as LoginDTO;
    const meta = { userAgent: req.headers["user-agent"], ip: req.ip };
    const result = await authService.login(email, password, meta);
    // Sync OAuth tokens: local filesystem + push to remote gateway (non-blocking)
    syncAuthProfiles(result.user.auth_profiles_path);
    pushAuthProfilesToGateway(result.user.id);
    res.json(result);
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

  async getMe(req: Request, res: Response): Promise<void> {
    const result = await authService.getMe(req.user!.userId);
    res.json(result);
  }

  async updateGateway(req: Request, res: Response): Promise<void> {
    const { gateway_url, gateway_token } = req.body;
    const result = await authService.updateGateway(req.user!.userId, {
      gateway_url,
      gateway_token,
    });
    res.json(result);
  }
}

export const authController = new AuthController();
