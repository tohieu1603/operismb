/**
 * Media Controller
 * Handles HTTP requests for media management
 */

import type { Request, Response } from "express";
import * as mediaFilesRepo from "../db/models/media-files";
import { MediaType } from "../db/entities/media.entity";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    mimeType.includes("text/")
  )
    return "document";
  return "other";
}

class MediaController {
  async list(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const type = req.query.type as MediaType | undefined;
    const folder = req.query.folder as string | undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "ASC" | "DESC") || "DESC";

    const result = await mediaFilesRepo.listMedia({
      page,
      limit,
      search,
      type,
      folder,
      sortBy,
      sortOrder,
    });

    res.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const media = await mediaFilesRepo.getMediaById(id);
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }
    res.json(media);
  }

  async getFolders(_req: Request, res: Response): Promise<void> {
    const folders = await mediaFilesRepo.getFolders();
    res.json(folders);
  }

  async getBySection(req: Request, res: Response): Promise<void> {
    const { pageSlug, sectionKey } = req.query;
    if (!pageSlug) {
      res.status(400).json({ error: "pageSlug is required" });
      return;
    }
    const media = await mediaFilesRepo.findBySection(
      pageSlug as string,
      sectionKey as string | undefined
    );
    res.json(media);
  }

  async upload(req: Request, res: Response): Promise<void> {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { folder, title, altText, caption, categoryId } = req.body;
    const uploadDir = process.env.UPLOAD_DIR || "uploads";
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const mediaType = getMediaType(file.mimetype);

    const media = await mediaFilesRepo.createMedia({
      filename,
      original_name: file.originalname,
      mime_type: file.mimetype,
      type: mediaType,
      size: file.size,
      url: `${baseUrl}/uploads/${filename}`,
      title: title || null,
      alt_text: altText || null,
      caption: caption || null,
      folder: folder || null,
      category_id: categoryId || null,
      assignments: [],
    });

    res.status(201).json(media);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;

    const existing = await mediaFilesRepo.getMediaById(id);
    if (!existing) {
      res.status(404).json({ error: "Media not found" });
      return;
    }

    const updateData: Partial<typeof existing> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.altText !== undefined || body.alt_text !== undefined)
      updateData.alt_text = body.altText ?? body.alt_text;
    if (body.caption !== undefined) updateData.caption = body.caption;
    if (body.folder !== undefined) updateData.folder = body.folder;
    if (body.categoryId !== undefined || body.category_id !== undefined)
      updateData.category_id = body.categoryId ?? body.category_id;

    const media = await mediaFilesRepo.updateMedia(id, updateData);
    res.json(media);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const media = await mediaFilesRepo.getMediaById(id);
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }

    // Try to delete file from disk
    try {
      const uploadDir = process.env.UPLOAD_DIR || "uploads";
      const filePath = path.join(uploadDir, media.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore file deletion errors
    }

    await mediaFilesRepo.deleteMedia(id);
    res.json({ message: "Media deleted successfully" });
  }

  async getUsage(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const media = await mediaFilesRepo.getMediaById(id);
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }
    res.json(media.used_in ?? []);
  }

  async assignToSection(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { pageSlug, sectionKey, elementId } = req.body;

    if (!pageSlug || !sectionKey) {
      res.status(400).json({ error: "pageSlug and sectionKey are required" });
      return;
    }

    const media = await mediaFilesRepo.assignToSection(id, { pageSlug, sectionKey, elementId });
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }
    res.json(media);
  }

  async unassignFromSection(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { pageSlug, sectionKey } = req.body;

    if (!pageSlug || !sectionKey) {
      res.status(400).json({ error: "pageSlug and sectionKey are required" });
      return;
    }

    const media = await mediaFilesRepo.unassignFromSection(id, pageSlug, sectionKey);
    if (!media) {
      res.status(404).json({ error: "Media not found" });
      return;
    }
    res.json(media);
  }
}

export const mediaController = new MediaController();
