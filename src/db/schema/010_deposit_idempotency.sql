-- Add unique index on payment_reference for idempotency
-- Prevents duplicate token credits when SePay retries webhook
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_orders_payment_reference
  ON deposit_orders(payment_reference) WHERE payment_reference IS NOT NULL;
