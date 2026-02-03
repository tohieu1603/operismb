-- Deposit Orders Schema for SePay Integration
-- Version: 1.0
-- Pricing: 1,000,000 tokens = 500,000 VND (1 token = 0.5 VND)

-- ============================================================================
-- 1. DEPOSIT ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS deposit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Order Details
  order_code TEXT NOT NULL UNIQUE, -- For SePay reference
  token_amount INTEGER NOT NULL,   -- Tokens to add
  amount_vnd INTEGER NOT NULL,     -- Amount in VND

  -- Status: pending, completed, failed, expired
  status TEXT NOT NULL DEFAULT 'pending',

  -- Payment Info
  payment_method TEXT,             -- bank_transfer, card, etc.
  payment_reference TEXT,          -- SePay transaction ID
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Expiry
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_orders_user_id ON deposit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_orders_order_code ON deposit_orders(order_code);
CREATE INDEX IF NOT EXISTS idx_deposit_orders_status ON deposit_orders(status);
CREATE INDEX IF NOT EXISTS idx_deposit_orders_created_at ON deposit_orders(created_at);

-- ============================================================================
-- 2. TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_deposit_orders_updated_at ON deposit_orders;
CREATE TRIGGER update_deposit_orders_updated_at
  BEFORE UPDATE ON deposit_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. CONSTRAINTS
-- ============================================================================
ALTER TABLE deposit_orders DROP CONSTRAINT IF EXISTS check_deposit_status;
ALTER TABLE deposit_orders ADD CONSTRAINT check_deposit_status
  CHECK (status IN ('pending', 'completed', 'failed', 'expired'));

ALTER TABLE deposit_orders DROP CONSTRAINT IF EXISTS check_token_amount_positive;
ALTER TABLE deposit_orders ADD CONSTRAINT check_token_amount_positive
  CHECK (token_amount > 0);

ALTER TABLE deposit_orders DROP CONSTRAINT IF EXISTS check_amount_vnd_positive;
ALTER TABLE deposit_orders ADD CONSTRAINT check_amount_vnd_positive
  CHECK (amount_vnd > 0);
