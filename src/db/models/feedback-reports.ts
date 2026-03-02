/**
 * Feedback Reports Repository
 * CRUD for feedback_reports table
 */

import { query, queryOne, queryAll } from "../connection";

// ── Types ───────────────────────────────────────────────────────────────

export type FeedbackReportType = "bug" | "feedback" | "suggestion";
export type FeedbackReportStatus = "open" | "in_progress" | "resolved" | "closed";

export interface FeedbackReport {
  id: string;
  user_id: string;
  type: FeedbackReportType;
  subject: string;
  content: string;
  status: FeedbackReportStatus;
  admin_notes: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields (optional)
  user_name?: string;
  user_email?: string;
}

export interface FeedbackReportCreate {
  user_id: string;
  type: FeedbackReportType;
  subject: string;
  content: string;
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function create(data: FeedbackReportCreate): Promise<FeedbackReport> {
  const result = await queryOne<FeedbackReport>(
    `INSERT INTO feedback_reports (user_id, type, subject, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.user_id, data.type, data.subject, data.content],
  );
  if (!result) throw new Error("Failed to create feedback report");
  return result;
}

export async function getByUser(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<{ reports: FeedbackReport[]; total: number }> {
  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM feedback_reports WHERE user_id = $1",
    [userId],
  );

  const reports = await queryAll<FeedbackReport>(
    `SELECT * FROM feedback_reports WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return { reports, total: parseInt(countResult?.count ?? "0", 10) };
}

export async function getAll(
  limit = 20,
  offset = 0,
  status?: FeedbackReportStatus,
): Promise<{ reports: FeedbackReport[]; total: number }> {
  const where = status ? "WHERE fr.status = $3" : "";
  const params: (string | number)[] = [limit, offset];
  if (status) params.push(status);

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM feedback_reports fr ${where}`,
    status ? [status] : [],
  );

  const reports = await queryAll<FeedbackReport>(
    `SELECT fr.*, u.name as user_name, u.email as user_email
     FROM feedback_reports fr
     JOIN users u ON u.id = fr.user_id
     ${where}
     ORDER BY fr.created_at DESC LIMIT $1 OFFSET $2`,
    params,
  );

  return { reports, total: parseInt(countResult?.count ?? "0", 10) };
}

export async function getById(id: string): Promise<FeedbackReport | null> {
  return queryOne<FeedbackReport>("SELECT * FROM feedback_reports WHERE id = $1", [id]);
}

export async function updateStatus(
  id: string,
  status: FeedbackReportStatus,
  adminNotes?: string,
): Promise<FeedbackReport | null> {
  return queryOne<FeedbackReport>(
    `UPDATE feedback_reports
     SET status = $2, admin_notes = COALESCE($3, admin_notes), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, status, adminNotes ?? null],
  );
}

// ── Export ───────────────────────────────────────────────────────────────

export const feedbackReportsRepo = {
  create,
  getByUser,
  getAll,
  getById,
  updateStatus,
};

export default feedbackReportsRepo;
