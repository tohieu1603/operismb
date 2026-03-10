/**
 * Redirect Controller
 * Handles HTTP requests for redirect management
 */

import type { Request, Response } from "express";
import * as redirectsRepo from "../db/models/redirects";

class RedirectController {
  async list(req: Request, res: Response): Promise<void> {
    const isActive =
      req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    const search = req.query.search as string | undefined;

    const redirects = await redirectsRepo.listRedirects({ isActive, search });
    res.json(redirects);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const redirect = await redirectsRepo.getRedirectById(id);
    if (!redirect) {
      res.status(404).json({ error: "Redirect not found" });
      return;
    }
    res.json(redirect);
  }

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body;

    if (!body.fromPath) {
      res.status(400).json({ error: "fromPath is required" });
      return;
    }
    if (!body.toPath) {
      res.status(400).json({ error: "toPath is required" });
      return;
    }

    // Check for duplicate fromPath
    const existing = await redirectsRepo.getRedirectByFromPath(body.fromPath);
    if (existing) {
      res.status(409).json({ error: "A redirect with this fromPath already exists" });
      return;
    }

    const redirect = await redirectsRepo.createRedirect({
      from_path: body.fromPath,
      to_path: body.toPath,
      status_code: body.statusCode ?? 301,
      is_active: body.isActive ?? true,
      note: body.note ?? null,
    });

    res.status(201).json(redirect);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;

    const existing = await redirectsRepo.getRedirectById(id);
    if (!existing) {
      res.status(404).json({ error: "Redirect not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};

    if (body.fromPath !== undefined) {
      // Check uniqueness if changing fromPath
      if (body.fromPath !== existing.from_path) {
        const conflict = await redirectsRepo.getRedirectByFromPath(body.fromPath);
        if (conflict) {
          res.status(409).json({ error: "A redirect with this fromPath already exists" });
          return;
        }
      }
      updateData.from_path = body.fromPath;
    }
    if (body.toPath !== undefined) updateData.to_path = body.toPath;
    if (body.statusCode !== undefined) updateData.status_code = body.statusCode;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.note !== undefined) updateData.note = body.note;

    const redirect = await redirectsRepo.updateRedirect(id, updateData);
    res.json(redirect);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const deleted = await redirectsRepo.deleteRedirect(id);
    if (!deleted) {
      res.status(404).json({ error: "Redirect not found" });
      return;
    }
    res.json({ message: "Redirect deleted successfully" });
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const redirect = await redirectsRepo.toggleActive(id);
    if (!redirect) {
      res.status(404).json({ error: "Redirect not found" });
      return;
    }
    res.json(redirect);
  }
}

export const redirectController = new RedirectController();
