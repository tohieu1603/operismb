-- Add unique_machine column to users table
-- Identifies the physical machine/device bound to this user account

ALTER TABLE users ADD COLUMN IF NOT EXISTS unique_machine VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_machine ON users(unique_machine) WHERE unique_machine IS NOT NULL;

COMMENT ON COLUMN users.unique_machine IS 'Unique machine/device identifier bound to this user';
