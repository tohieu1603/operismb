/**
 * API Key Controller
 * Handles HTTP requests for API key management
 */

import type { Request, Response } from "express";
import { apiKeyService } from "../services/api-key.service.js";
import { Errors } from "../core/errors/api-error.js";

class ApiKeyController {
  // User's own keys
  async list(req: Request, res: Response): Promise<void> {
    const keys = await apiKeyService.listByUser(req.user!.userId);
    res.json(keys);
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, permissions, expires_at } = req.body;
    const expiresAt = expires_at ? new Date(expires_at) : undefined;
    const result = await apiKeyService.create(
      req.user!.userId,
      name || "Default",
      permissions,
      expiresAt,
    );
    res.status(201).json(result);
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    // Verify ownership
    const isOwner = await apiKeyService.verifyOwnership(id, req.user!.userId);
    if (!isOwner) {
      throw Errors.notFound("API key");
    }

    const result = await apiKeyService.update(id, req.body);
    res.json(result);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    // Verify ownership
    const isOwner = await apiKeyService.verifyOwnership(id, req.user!.userId);
    if (!isOwner) {
      throw Errors.notFound("API key");
    }

    await apiKeyService.delete(id);
    res.json({ success: true });
  }

  // Admin routes
  async listAll(_req: Request, res: Response): Promise<void> {
    const keys = await apiKeyService.listAll();
    res.json(keys);
  }

  async adminUpdate(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const result = await apiKeyService.update(id, req.body);
    res.json(result);
  }

  async adminDelete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await apiKeyService.delete(id);
    res.json({ success: true });
  }
}

export const apiKeyController = new ApiKeyController();
