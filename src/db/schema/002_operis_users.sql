-- Operis Users & Authentication Schema
-- Version: 2.0

-- ============================================================================
-- 1. USERS TABLE (Operis admin users - different from customers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- admin, user

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_active_at TIMESTAMP WITH TIME ZONE,

  -- Token balance (for API usage)
  token_balance INTEGER NOT NULL DEFAULT 100,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. USER API KEYS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Key Info
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for display: "sk_a1b2..."
  name TEXT NOT NULL DEFAULT 'Default',

  -- Permissions
  permissions TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_key_hash ON user_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- 3. TOKEN TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Transaction Details
  type TEXT NOT NULL, -- credit, debit, adjustment
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,

  -- Reference
  description TEXT,
  reference_id TEXT, -- session_id, order_id, etc.

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(type);

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_user_api_keys_updated_at ON user_api_keys;
CREATE TRIGGER update_user_api_keys_updated_at
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. CONSTRAINTS
-- ============================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE users ADD CONSTRAINT check_user_role
  CHECK (role IN ('admin', 'user'));

ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS check_transaction_type;
ALTER TABLE token_transactions ADD CONSTRAINT check_transaction_type
  CHECK (type IN ('credit', 'debit', 'adjustment'));
