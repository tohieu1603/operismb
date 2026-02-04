-- Token Usage Analytics
-- Track input/output tokens per request for analytics

CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('chat', 'cronjob', 'api')),
  request_id VARCHAR(100), -- chat_id, cronjob_id, or api request identifier
  model VARCHAR(100),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_tokens INTEGER NOT NULL DEFAULT 0, -- actual tokens deducted from balance
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient analytics queries
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_type ON token_usage(request_type);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at DESC);

-- Composite index for date range queries per user
CREATE INDEX IF NOT EXISTS idx_token_usage_user_type_date ON token_usage(user_id, request_type, created_at DESC);
