/**
 * Feedback Controller — customer bug reports & feedback
 */

import type { Request, Response, NextFunction } from "express";
import { feedbackService } from "../services/feedback.service";
import { MSG } from "../constants/messages";

export async function createReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { type, subject, content } = req.body;

    const report = await feedbackService.create(userId, type ?? "bug", subject, content);
    res.status(201).json({ report, message: MSG.REPORT_CREATED });
  } catch (error) {
    next(error);
  }
}

export async function getMyReports(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);

    const result = await feedbackService.getUserReports(userId, limit, offset);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAllReports(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const status = req.query.status as string | undefined;

    const result = await feedbackService.getAllReports(limit, offset, status as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateReportStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, admin_notes } = req.body;

    const report = await feedbackService.updateStatus(req.params.id, status, admin_notes);
    res.json({ report, message: MSG.REPORT_UPDATED });
  } catch (error) {
    next(error);
  }
}
