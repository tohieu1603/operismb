/**
 * Auth Controller
 * Handles HTTP requests for authentication
 */

import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import type { RegisterDTO, LoginDTO } from "../validators/auth.validator.js";

class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const { email, password, name } = req.body as RegisterDTO;
    const result = await authService.register(email, password, name);
    res.status(201).json(result);
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as LoginDTO;
    const result = await authService.login(email, password);
    res.json(result);
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.json(result);
  }

  async logout(_req: Request, res: Response): Promise<void> {
    res.json({ success: true });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const result = await authService.getMe(req.user!.userId);
    res.json(result);
  }
}

export const authController = new AuthController();
