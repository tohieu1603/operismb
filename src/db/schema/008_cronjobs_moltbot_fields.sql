-- Add Moltbot-compatible fields to cronjobs table
-- Supports: schedule types (cron/every/at), session target, wake mode, delivery options

-- 1. Add description field
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Add schedule type fields (cron, every, at)
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'cron';
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS schedule_tz TEXT; -- timezone for cron
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS schedule_interval_ms BIGINT; -- for "every" type
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS schedule_at_ms BIGINT; -- for "at" type (timestamp)

-- Rename schedule to schedule_expr for clarity
ALTER TABLE cronjobs RENAME COLUMN schedule TO schedule_expr;

-- 3. Add execution config fields
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS session_target TEXT NOT NULL DEFAULT 'main';
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS wake_mode TEXT NOT NULL DEFAULT 'now';

-- 4. Add payload fields (what to send to gateway)
-- Rename action/task to message (Moltbot terminology)
ALTER TABLE cronjobs RENAME COLUMN action TO message;
ALTER TABLE cronjobs DROP COLUMN IF EXISTS task;

ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS thinking TEXT;
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER;
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS deliver BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS channel TEXT; -- "last" or channel ID
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS to_recipient TEXT;

-- 5. Add state tracking fields
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS delete_after_run BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS last_status TEXT; -- ok, error, skipped
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 6. Add constraints for enum-like fields
ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_schedule_type_check
  CHECK (schedule_type IN ('cron', 'every', 'at'));

ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_session_target_check
  CHECK (session_target IN ('main', 'isolated'));

ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_wake_mode_check
  CHECK (wake_mode IN ('next-heartbeat', 'now'));

ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_last_status_check
  CHECK (last_status IS NULL OR last_status IN ('ok', 'error', 'skipped'));

-- 7. Add index for new fields
CREATE INDEX IF NOT EXISTS idx_cronjobs_schedule_type ON cronjobs(schedule_type);
CREATE INDEX IF NOT EXISTS idx_cronjobs_session_target ON cronjobs(session_target);
