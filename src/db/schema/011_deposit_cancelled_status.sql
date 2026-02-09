-- Add 'cancelled' to deposit_orders status constraint
-- Distinguishes user-cancelled from auto-expired orders
ALTER TABLE deposit_orders DROP CONSTRAINT IF EXISTS check_deposit_status;
ALTER TABLE deposit_orders ADD CONSTRAINT check_deposit_status
  CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'cancelled'));
