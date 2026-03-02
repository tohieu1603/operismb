-- Add free_token_balance column (separate from paid token_balance)
-- Free tokens are reset every 5h, paid tokens are only from deposits
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_token_balance INTEGER NOT NULL DEFAULT 200000;
