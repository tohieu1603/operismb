/**
 * Cloudflare Tunnel Auto-Provisioning Service
 *
 * Creates a named tunnel, configures ingress, sets up DNS CNAME,
 * and returns a tunnel token for cloudflared to connect.
 *
 * Env vars required:
 *   CLOUDFLARE_API_TOKEN  — API token with Tunnel:Edit + DNS:Edit scopes
 *   CLOUDFLARE_ACCOUNT_ID — Account where tunnels are created
 *   CLOUDFLARE_ZONE_ID    — Zone for DNS records (operis.vn)
 *   CLOUDFLARE_BASE_DOMAIN — Base domain (default: operis.vn)
 */

import { updateUser, getUserById } from "../db/models/users.js";

const CF_API = "https://api.cloudflare.com/client/v4";
const GATEWAY_LOCAL_PORT = 18789;

function getConfig() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const baseDomain = process.env.CLOUDFLARE_BASE_DOMAIN || "operis.vn";

  if (!apiToken || !accountId || !zoneId) {
    throw new Error("Cloudflare env vars not configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID)");
  }

  return { apiToken, accountId, zoneId, baseDomain };
}

function headers(apiToken: string) {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };
}

interface CfApiResponse<T = unknown> {
  success: boolean;
  result: T;
  errors: Array<{ code: number; message: string }>;
}

interface CfTunnel {
  id: string;
  name: string;
  token?: string;
}

interface CfDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
}

export interface ProvisionResult {
  tunnelId: string;
  tunnelToken: string;
  domain: string;
  tunnelName: string;
}

export interface TunnelStatusResult {
  tunnelId: string;
  tunnelName: string;
  domain: string;
  provisionedAt: Date;
}

/**
 * Provision a Cloudflare tunnel for a user.
 * Idempotent: if user already has a tunnel, returns existing info + refreshed token.
 */
export async function provisionTunnel(userId: string, email: string): Promise<ProvisionResult> {
  const cfg = getConfig();
  const tunnelName = `gw-${userId.slice(0, 8)}`;
  const domain = `${tunnelName}.${cfg.baseDomain}`;

  // Check if user already has a provisioned tunnel
  const user = await getUserById(userId);
  if (user?.cf_tunnel_id) {
    // Tunnel exists — get a fresh token
    const token = await getTunnelToken(cfg.accountId, user.cf_tunnel_id, cfg.apiToken);
    return {
      tunnelId: user.cf_tunnel_id,
      tunnelToken: token,
      domain: user.cf_tunnel_domain || domain,
      tunnelName: user.cf_tunnel_name || tunnelName,
    };
  }

  // Step 1: Create tunnel
  const tunnel = await createTunnel(cfg.accountId, tunnelName, cfg.apiToken);

  // Step 2: Configure ingress (route domain to localhost gateway)
  await configureTunnelIngress(cfg.accountId, tunnel.id, domain, cfg.apiToken);

  // Step 3: Create DNS CNAME record
  const dnsRecord = await createDnsCname(cfg.zoneId, domain, tunnel.id, cfg.apiToken);

  // Step 4: Get tunnel run token
  const tunnelToken = await getTunnelToken(cfg.accountId, tunnel.id, cfg.apiToken);

  // Step 5: Update user DB
  await updateUser(userId, {
    cf_tunnel_id: tunnel.id,
    cf_tunnel_name: tunnelName,
    cf_tunnel_domain: domain,
    cf_dns_record_id: dnsRecord.id,
    cf_provisioned_at: new Date(),
    gateway_url: `https://${domain}`,
  });

  return { tunnelId: tunnel.id, tunnelToken, domain, tunnelName };
}

/**
 * Deprovision a user's tunnel: delete DNS record + delete tunnel + clear DB.
 */
export async function deprovisionTunnel(userId: string): Promise<void> {
  const cfg = getConfig();
  const user = await getUserById(userId);
  if (!user?.cf_tunnel_id) return;

  // Delete DNS CNAME record
  if (user.cf_dns_record_id) {
    try {
      await deleteDnsRecord(cfg.zoneId, user.cf_dns_record_id, cfg.apiToken);
    } catch {
      // Non-fatal: DNS record may already be gone
    }
  }

  // Delete tunnel (must clean up connections first)
  try {
    await deleteTunnel(cfg.accountId, user.cf_tunnel_id, cfg.apiToken);
  } catch {
    // Non-fatal: tunnel may already be deleted
  }

  // Clear DB fields
  await updateUser(userId, {
    cf_tunnel_id: null,
    cf_tunnel_name: null,
    cf_tunnel_domain: null,
    cf_dns_record_id: null,
    cf_provisioned_at: null,
    gateway_url: null,
  });
}

/**
 * Get tunnel status for a user.
 */
export async function getTunnelStatus(userId: string): Promise<TunnelStatusResult | null> {
  const user = await getUserById(userId);
  if (!user?.cf_tunnel_id || !user.cf_provisioned_at) return null;

  return {
    tunnelId: user.cf_tunnel_id,
    tunnelName: user.cf_tunnel_name || "",
    domain: user.cf_tunnel_domain || "",
    provisionedAt: user.cf_provisioned_at,
  };
}

// ============================================================================
// Cloudflare API helpers
// ============================================================================

async function createTunnel(accountId: string, name: string, apiToken: string): Promise<CfTunnel> {
  // Generate a random tunnel secret (32 bytes, base64)
  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const tunnelSecret = Buffer.from(secretBytes).toString("base64");

  const res = await fetch(`${CF_API}/accounts/${accountId}/cfd_tunnel`, {
    method: "POST",
    headers: headers(apiToken),
    body: JSON.stringify({
      name,
      tunnel_secret: tunnelSecret,
      config_src: "cloudflare",
    }),
  });

  const data: CfApiResponse<CfTunnel> = await res.json();
  if (!data.success) {
    throw new Error(`Failed to create tunnel: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}

async function configureTunnelIngress(
  accountId: string,
  tunnelId: string,
  hostname: string,
  apiToken: string,
): Promise<void> {
  const res = await fetch(`${CF_API}/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    method: "PUT",
    headers: headers(apiToken),
    body: JSON.stringify({
      config: {
        ingress: [
          {
            hostname,
            service: `http://localhost:${GATEWAY_LOCAL_PORT}`,
            originRequest: {},
          },
          {
            service: "http_status:404",
          },
        ],
      },
    }),
  });

  const data: CfApiResponse = await res.json();
  if (!data.success) {
    throw new Error(`Failed to configure tunnel ingress: ${data.errors.map((e) => e.message).join(", ")}`);
  }
}

async function createDnsCname(
  zoneId: string,
  name: string,
  tunnelId: string,
  apiToken: string,
): Promise<CfDnsRecord> {
  const res = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: headers(apiToken),
    body: JSON.stringify({
      type: "CNAME",
      name,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      comment: "Auto-provisioned by Operis",
    }),
  });

  const data: CfApiResponse<CfDnsRecord> = await res.json();
  if (!data.success) {
    throw new Error(`Failed to create DNS record: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}

async function getTunnelToken(accountId: string, tunnelId: string, apiToken: string): Promise<string> {
  const res = await fetch(`${CF_API}/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`, {
    method: "GET",
    headers: headers(apiToken),
  });

  const data: CfApiResponse<string> = await res.json();
  if (!data.success) {
    throw new Error(`Failed to get tunnel token: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}

async function deleteDnsRecord(zoneId: string, recordId: string, apiToken: string): Promise<void> {
  const res = await fetch(`${CF_API}/zones/${zoneId}/dns_records/${recordId}`, {
    method: "DELETE",
    headers: headers(apiToken),
  });

  const data: CfApiResponse = await res.json();
  if (!data.success) {
    throw new Error(`Failed to delete DNS record: ${data.errors.map((e) => e.message).join(", ")}`);
  }
}

async function deleteTunnel(accountId: string, tunnelId: string, apiToken: string): Promise<void> {
  // Clean up connections first
  await fetch(`${CF_API}/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`, {
    method: "DELETE",
    headers: headers(apiToken),
  });

  const res = await fetch(`${CF_API}/accounts/${accountId}/cfd_tunnel/${tunnelId}`, {
    method: "DELETE",
    headers: headers(apiToken),
  });

  const data: CfApiResponse = await res.json();
  if (!data.success) {
    throw new Error(`Failed to delete tunnel: ${data.errors.map((e) => e.message).join(", ")}`);
  }
}
