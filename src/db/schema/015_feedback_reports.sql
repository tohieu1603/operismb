-- Feedback reports table for customer bug reports and feedback
CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL DEFAULT 'bug',
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_reports(status);
