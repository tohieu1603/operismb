-- Make cronjobs work with Operis users (not customers)
-- - box_id nullable (Operis users don't have boxes)
-- - customer_id references users table instead of customers

-- 1. Make box_id nullable
ALTER TABLE cronjobs DROP CONSTRAINT IF EXISTS cronjobs_box_id_fkey;
ALTER TABLE cronjobs ALTER COLUMN box_id DROP NOT NULL;
ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_box_id_fkey
  FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE;

-- 2. Change customer_id FK from customers to users table
ALTER TABLE cronjobs DROP CONSTRAINT IF EXISTS cronjobs_customer_id_fkey;
ALTER TABLE cronjobs ADD CONSTRAINT cronjobs_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;
