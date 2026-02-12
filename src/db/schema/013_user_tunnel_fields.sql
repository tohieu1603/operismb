-- Add Cloudflare tunnel fields to users table
-- Stores auto-provisioned tunnel metadata per user

ALTER TABLE users ADD COLUMN IF NOT EXISTS cf_tunnel_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cf_tunnel_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cf_tunnel_domain VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cf_dns_record_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cf_provisioned_at TIMESTAMPTZ;

COMMENT ON COLUMN users.cf_tunnel_id IS 'Cloudflare tunnel UUID';
COMMENT ON COLUMN users.cf_tunnel_name IS 'Tunnel name (gw-{userId})';
COMMENT ON COLUMN users.cf_tunnel_domain IS 'Tunnel domain (gw-{userId}.operis.vn)';
COMMENT ON COLUMN users.cf_dns_record_id IS 'Cloudflare DNS CNAME record ID';
COMMENT ON COLUMN users.cf_provisioned_at IS 'When the tunnel was provisioned';
