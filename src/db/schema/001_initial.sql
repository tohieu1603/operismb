-- Operis Cloud Database Schema
-- Version: 1.0
-- Database: PostgreSQL 14+

-- ============================================================================
-- 1. CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  plan TEXT NOT NULL DEFAULT 'starter', -- starter, professional, enterprise
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Billing
  stripe_customer_id TEXT,
  subscription_status TEXT, -- active, canceled, past_due

  -- Limits
  max_boxes INTEGER NOT NULL DEFAULT 1,
  max_agents_per_box INTEGER NOT NULL DEFAULT 5,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_stripe ON customers(stripe_customer_id);

-- ============================================================================
-- 2. BOXES TABLE (Mini-PC devices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Authentication
  api_key_hash TEXT NOT NULL,
  hardware_id TEXT UNIQUE,

  -- Box Info
  name TEXT NOT NULL,
  hostname TEXT,
  os TEXT, -- linux, windows, darwin
  arch TEXT, -- amd64, arm64

  -- Connection Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, online, offline, error
  last_seen_at TIMESTAMP WITH TIME ZONE,
  last_ip TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_boxes_customer_id ON boxes(customer_id);
CREATE INDEX IF NOT EXISTS idx_boxes_status ON boxes(status);
CREATE INDEX IF NOT EXISTS idx_boxes_last_seen ON boxes(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_boxes_hardware_id ON boxes(hardware_id);
CREATE INDEX IF NOT EXISTS idx_boxes_customer_status ON boxes(customer_id, status);

-- ============================================================================
-- 3. AGENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Agent Config
  name TEXT NOT NULL,
  model TEXT NOT NULL, -- claude-sonnet-4.5, gpt-4, etc.
  system_prompt TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, error
  last_active_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agents_box_id ON agents(box_id);
CREATE INDEX IF NOT EXISTS idx_agents_customer_id ON agents(customer_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_box_status ON agents(box_id, status);

-- ============================================================================
-- 4. CRONJOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS cronjobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Job Config
  name TEXT NOT NULL,
  schedule TEXT NOT NULL, -- cron expression: "0 9 * * *"
  action TEXT NOT NULL, -- create_agent_with_task, run_bash_command, etc.
  task TEXT, -- task description or command

  -- Status
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cronjobs_box_id ON cronjobs(box_id);
CREATE INDEX IF NOT EXISTS idx_cronjobs_customer_id ON cronjobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_cronjobs_enabled ON cronjobs(enabled);
CREATE INDEX IF NOT EXISTS idx_cronjobs_next_run ON cronjobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_cronjobs_enabled_next_run ON cronjobs(enabled, next_run_at) WHERE enabled = true;

-- ============================================================================
-- 5. CRONJOB EXECUTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS cronjob_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cronjob_id UUID NOT NULL REFERENCES cronjobs(id) ON DELETE CASCADE,

  -- Execution Details
  status TEXT NOT NULL, -- success, failure
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Results
  output TEXT,
  error TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cronjob_executions_cronjob_id ON cronjob_executions(cronjob_id);
CREATE INDEX IF NOT EXISTS idx_cronjob_executions_started_at ON cronjob_executions(started_at);

-- ============================================================================
-- 6. COMMANDS LOG TABLE (Partitioned by month)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commands_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Command Details
  command_id TEXT NOT NULL, -- from protocol
  command_type TEXT NOT NULL, -- bash.exec, browser.navigate, etc.
  command_payload JSONB,

  -- Result
  success BOOLEAN,
  response_payload JSONB,
  error TEXT,

  -- Timing
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  received_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_commands_log_box_id ON commands_log(box_id);
CREATE INDEX IF NOT EXISTS idx_commands_log_agent_id ON commands_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_commands_log_sent_at ON commands_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_commands_log_command_type ON commands_log(command_type);

-- ============================================================================
-- 7. SESSIONS TABLE (For auth sessions, Redis alternative)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Session Data
  data JSONB NOT NULL,

  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- 8. BOX API KEYS TABLE (Multiple keys per box)
-- ============================================================================
CREATE TABLE IF NOT EXISTS box_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,

  -- Key Info
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for display: "box_a1b2..."
  name TEXT NOT NULL DEFAULT 'Default',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(box_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_box_api_keys_box_id ON box_api_keys(box_id);
CREATE INDEX IF NOT EXISTS idx_box_api_keys_key_hash ON box_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_box_api_keys_active ON box_api_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- 9. TRIGGERS FOR updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_boxes_updated_at ON boxes;
CREATE TRIGGER update_boxes_updated_at
  BEFORE UPDATE ON boxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_cronjobs_updated_at ON cronjobs;
CREATE TRIGGER update_cronjobs_updated_at
  BEFORE UPDATE ON cronjobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 10. CONSTRAINTS
-- ============================================================================
ALTER TABLE boxes DROP CONSTRAINT IF EXISTS check_box_status;
ALTER TABLE boxes ADD CONSTRAINT check_box_status
  CHECK (status IN ('pending', 'online', 'offline', 'error'));

ALTER TABLE agents DROP CONSTRAINT IF EXISTS check_agent_status;
ALTER TABLE agents ADD CONSTRAINT check_agent_status
  CHECK (status IN ('active', 'paused', 'error'));

ALTER TABLE cronjob_executions DROP CONSTRAINT IF EXISTS check_positive_duration;
ALTER TABLE cronjob_executions ADD CONSTRAINT check_positive_duration
  CHECK (duration_ms IS NULL OR duration_ms >= 0);

-- ============================================================================
-- 11. PARTIAL INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_boxes_online ON boxes(customer_id) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(box_id) WHERE status = 'active';

-- ============================================================================
-- 12. FUNCTION TO DELETE EXPIRED SESSIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron: SELECT cron.schedule('0 * * * *', 'SELECT delete_expired_sessions()');
