/**
 * Feedback Service — customer bug reports & feedback
 */

import { Errors } from "../core/errors/api-error";
import { feedbackReportsRepo } from "../db/index";
import type { FeedbackReport, FeedbackReportType, FeedbackReportStatus } from "../db/models/feedback-reports";
import { MSG } from "../constants/messages";

const VALID_TYPES: FeedbackReportType[] = ["bug", "feedback", "suggestion"];
const VALID_STATUSES: FeedbackReportStatus[] = ["open", "in_progress", "resolved", "closed"];

class FeedbackService {
  async create(
    userId: string,
    type: FeedbackReportType,
    subject: string,
    content: string,
  ): Promise<FeedbackReport> {
    if (!subject?.trim()) throw Errors.badRequest(MSG.REPORT_SUBJECT_REQUIRED);
    if (!content?.trim()) throw Errors.badRequest(MSG.REPORT_CONTENT_REQUIRED);
    if (!VALID_TYPES.includes(type)) throw Errors.badRequest(MSG.REPORT_TYPE_INVALID);

    return feedbackReportsRepo.create({
      user_id: userId,
      type,
      subject: subject.trim(),
      content: content.trim(),
    });
  }

  async getUserReports(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ reports: FeedbackReport[]; total: number }> {
    return feedbackReportsRepo.getByUser(userId, limit, offset);
  }

  async getAllReports(
    limit = 20,
    offset = 0,
    status?: FeedbackReportStatus,
  ): Promise<{ reports: FeedbackReport[]; total: number }> {
    if (status && !VALID_STATUSES.includes(status)) {
      throw Errors.badRequest(MSG.REPORT_STATUS_INVALID);
    }
    return feedbackReportsRepo.getAll(limit, offset, status);
  }

  async updateStatus(
    id: string,
    status: FeedbackReportStatus,
    adminNotes?: string,
  ): Promise<FeedbackReport> {
    if (!VALID_STATUSES.includes(status)) throw Errors.badRequest(MSG.REPORT_STATUS_INVALID);

    const report = await feedbackReportsRepo.updateStatus(id, status, adminNotes);
    if (!report) throw Errors.notFound("báo cáo");
    return report;
  }
}

export const feedbackService = new FeedbackService();
