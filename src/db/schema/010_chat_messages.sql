CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model VARCHAR(100),
  provider VARCHAR(100),
  tokens_used INTEGER DEFAULT 0,
  cost NUMERIC(10, 6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_conv
  ON chat_messages(user_id, conversation_id, created_at DESC);
