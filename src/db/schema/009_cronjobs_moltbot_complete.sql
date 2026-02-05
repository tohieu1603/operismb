-- Complete Moltbot cron compatibility migration
-- Adds all remaining fields to match Moltbot gateway cron schema exactly

-- 0. Fix wake_mode default (should be "next-heartbeat" per Moltbot spec)
ALTER TABLE cronjobs ALTER COLUMN wake_mode SET DEFAULT 'next-heartbeat';

-- 1. Agent ID - which agent to use (default: "main")
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS agent_id TEXT DEFAULT 'main';

-- 2. Schedule anchor for "every" type (ms timestamp)
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS schedule_anchor_ms BIGINT;

-- 3. Payload kind - systemEvent (main session) or agentTurn (isolated)
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS payload_kind TEXT NOT NULL DEFAULT 'agentTurn';
ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_payload_kind_check
  CHECK (payload_kind IN ('systemEvent', 'agentTurn'));

-- 4. Allow unsafe external content (for agentTurn)
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS allow_unsafe_external_content BOOLEAN NOT NULL DEFAULT false;

-- 5. Best effort deliver - don't fail if delivery channel unavailable
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS best_effort_deliver BOOLEAN NOT NULL DEFAULT false;

-- 6. Isolation config (for isolated sessions)
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS isolation_post_to_main_prefix TEXT;
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS isolation_post_to_main_mode TEXT DEFAULT 'summary';
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS isolation_post_to_main_max_chars INTEGER DEFAULT 8000;

ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_isolation_mode_check
  CHECK (isolation_post_to_main_mode IS NULL OR isolation_post_to_main_mode IN ('summary', 'full'));

-- 7. Running state tracking
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS running_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE cronjobs ADD COLUMN IF NOT EXISTS last_duration_ms INTEGER;

-- 8. Add index for agent_id
CREATE INDEX IF NOT EXISTS idx_cronjobs_agent_id ON cronjobs(agent_id);

-- 9. Add index for running jobs
CREATE INDEX IF NOT EXISTS idx_cronjobs_running ON cronjobs(running_at) WHERE running_at IS NOT NULL;
