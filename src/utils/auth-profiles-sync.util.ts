/**
 * Auth Profiles Sync Utility
 * Writes/clears OpenClaw auth-profiles.json based on token vault
 *
 * Two sync modes:
 * 1. Local: write directly to filesystem (server + OpenClaw co-located)
 * 2. Gateway push: POST to user's Moltbot gateway via webhook (remote client)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { settingsRepo } from "../db/models/settings";
import { getUserById, updateUser } from "../db/models/users";

const SETTINGS_KEY = "anthropic_oauth_tokens";
const ALGORITHM = "aes-256-gcm";

// Default path; override via AUTH_PROFILES_PATH env var
function getAuthProfilesPath(): string {
  return process.env.AUTH_PROFILES_PATH
    || path.join(os.homedir(), ".openclaw/agents/main/agent/auth-profiles.json");
}

function decrypt(blob: string): string {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  const key = crypto.createHash("sha256").update(secret).digest();
  const [ivB64, tagB64, dataB64] = blob.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/**
 * Fetch all tokens from vault and write auth-profiles.json
 * Each token becomes a separate profile so OpenClaw can fallback automatically
 * @param userAuthProfilesPath - per-user path from users.auth_profiles_path (optional, falls back to env/default)
 * Runs async, logs errors but never throws (non-blocking)
 */
export async function syncAuthProfiles(userAuthProfilesPath?: string | null): Promise<void> {
  try {
    const raw = await settingsRepo.getSetting(SETTINGS_KEY);
    if (!raw) {
      console.log("[auth-sync] No tokens in vault, skipping");
      return;
    }

    const encryptedList: string[] = JSON.parse(raw);
    const tokens = encryptedList.map((blob: string) => decrypt(blob));

    if (tokens.length === 0) {
      console.log("[auth-sync] Empty token list, skipping");
      return;
    }

    // Build profiles: first token = "anthropic:default", rest = "anthropic:pool-N"
    const profiles: Record<string, { type: string; provider: string; token: string }> = {};
    tokens.forEach((token, i) => {
      const name = i === 0 ? "anthropic:default" : `anthropic:pool-${i}`;
      profiles[name] = { type: "token", provider: "anthropic", token };
    });

    // Use user-specific path, then env var, then default
    const filePath = userAuthProfilesPath || getAuthProfilesPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Read existing file to preserve usageStats and other OpenClaw tracking data
    let existing: Record<string, unknown> = {};
    try {
      const content = fs.readFileSync(filePath, "utf8");
      existing = JSON.parse(content);
    } catch {
      // File doesn't exist or invalid JSON — start fresh
    }

    // Merge: only update token in each profile, keep everything else intact
    const existingProfiles = (existing.profiles as Record<string, Record<string, unknown>>) || {};
    for (const [id, newProfile] of Object.entries(profiles)) {
      existingProfiles[id] = { ...existingProfiles[id], ...newProfile };
    }

    const merged = {
      ...existing,
      version: 1,
      profiles: existingProfiles,
    };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + "\n");

    console.log(`[auth-sync] auth-profiles.json updated with ${tokens.length} token(s) → ${filePath}`);
  } catch (err) {
    console.error("[auth-sync] Failed to sync:", err);
  }
}

/**
 * Clear auth-profiles.json on logout
 * Runs async, logs errors but never throws (non-blocking)
 */
export async function clearAuthProfiles(userAuthProfilesPath?: string | null): Promise<void> {
  try {
    const filePath = userAuthProfilesPath || getAuthProfilesPath();
    if (!fs.existsSync(filePath)) return;

    // Read existing to preserve usageStats
    let existing: Record<string, unknown> = {};
    try {
      const content = fs.readFileSync(filePath, "utf8");
      existing = JSON.parse(content);
    } catch {
      // Invalid JSON — overwrite entirely
    }

    fs.writeFileSync(filePath, JSON.stringify({
      ...existing,
      version: 1,
      profiles: {},
      lastGood: {},
    }, null, 2) + "\n");

    console.log("[auth-sync] auth-profiles.json cleared");
  } catch (err) {
    console.error("[auth-sync] Failed to clear:", err);
  }
}

// ============================================
// Gateway Push (remote clients via webhook)
// ============================================

const GATEWAY_PUSH_TIMEOUT_MS = 10_000;
const REGISTER_SECRET = process.env.GATEWAY_REGISTER_SECRET || "operis-gateway-register-secret";
// operis-api public URL for gateway callback (gateway → operis-api PUT /gateway/register)
function getOperisApiUrl(): string {
  const raw = process.env.OPERIS_API_URL || "http://127.0.0.1:3025";
  // Auto-add https:// if user forgot the protocol
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    return `https://${raw}`;
  }
  return raw;
}

/** Build auth-profiles JSON from vault tokens */
async function buildAuthProfilesJson(): Promise<{
  version: number;
  profiles: Record<string, { type: string; provider: string; token: string }>;
  lastGood: Record<string, string>;
} | null> {
  const raw = await settingsRepo.getSetting(SETTINGS_KEY);
  if (!raw) return null;

  const encryptedList: string[] = JSON.parse(raw);
  const tokens = encryptedList.map((blob: string) => decrypt(blob));
  if (tokens.length === 0) return null;

  const profiles: Record<string, { type: string; provider: string; token: string }> = {};
  tokens.forEach((token, i) => {
    const name = i === 0 ? "anthropic:default" : `anthropic:pool-${i}`;
    profiles[name] = { type: "token", provider: "anthropic", token };
  });

  return { version: 1, profiles, lastGood: { anthropic: "anthropic:default" } };
}

/** POST to user's gateway hook endpoint */
async function callGatewayHook(
  gatewayUrl: string,
  hooksToken: string,
  hookName: string,
  body: unknown,
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GATEWAY_PUSH_TIMEOUT_MS);

  try {
    const url = `${gatewayUrl}/hooks/${hookName}`;
    console.log(`[auth-sync] POST ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hooksToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[auth-sync] Gateway ${response.status}: ${errText}`);
      return false;
    }

    return true;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.error("[auth-sync] Gateway push timeout");
    } else {
      console.error("[auth-sync] Gateway push failed:", err.message);
    }
    return false;
  }
}

/**
 * Read gateway config from local openclaw.json
 * Both operis-api and openclaw run on the same client machine
 */
function readLocalGatewayConfig(): { gatewayUrl: string; gatewayToken: string; hooksToken: string } | null {
  const configPath = process.env.OPENCLAW_CONFIG_PATH
    || path.join(os.homedir(), ".openclaw/openclaw.json");
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const gatewayToken = raw.gateway?.auth?.token || raw.env?.vars?.GATEWAY_TOKEN || "";
    const hooksToken = raw.hooks?.token || "";
    const port = raw.gateway?.port || 3000;
    const bind = raw.gateway?.bind === "loopback" ? "127.0.0.1" : "0.0.0.0";
    if (!gatewayToken && !hooksToken) return null;
    return { gatewayUrl: `http://${bind}:${port}`, gatewayToken, hooksToken };
  } catch {
    return null;
  }
}

/**
 * Push auth-profiles to user's gateway on login
 * 1. Read local openclaw.json → update gateway tokens in DB
 * 2. POST gateway_url/hooks/sync-auth-profiles { authProfiles }
 * Non-blocking, logs errors
 */
export async function pushAuthProfilesToGateway(userId: string): Promise<void> {
  try {
    // Step 1: Check if user already has a remote gateway configured
    const user = await getUserById(userId);

    // Only read local openclaw.json if user has NO gateway_url in DB (co-located setup)
    // Remote users already have their own gateway_url — don't overwrite with local config
    if (!user?.gateway_url) {
      const gwConfig = readLocalGatewayConfig();
      if (gwConfig) {
        await updateUser(userId, {
          gateway_url: gwConfig.gatewayUrl,
          gateway_token: gwConfig.gatewayToken,
          gateway_hooks_token: gwConfig.hooksToken,
        });
        console.log(`[auth-sync] Updated gateway config from local openclaw.json → ${gwConfig.gatewayUrl}`);
      }
    }

    // Step 2: Re-read user (with possibly updated tokens) and push auth-profiles
    const freshUser = await getUserById(userId);
    const hooksToken = freshUser?.gateway_hooks_token || freshUser?.gateway_token;
    if (!freshUser?.gateway_url || !hooksToken) {
      console.log("[auth-sync] No gateway configured for user, skipping push");
      return;
    }

    const authProfiles = await buildAuthProfilesJson();
    if (!authProfiles) {
      console.log("[auth-sync] No tokens in vault, skipping push");
      return;
    }

    // Include callback so gateway calls back PUT /gateway/register with its real token
    const callback = {
      url: `${getOperisApiUrl()}/api/gateway/register`,
      email: freshUser.email,
      secret: REGISTER_SECRET,
    };

    const ok = await callGatewayHook(
      freshUser.gateway_url,
      hooksToken,
      "sync-auth-profiles",
      { authProfiles, callback },
    );

    if (ok) {
      console.log(`[auth-sync] Pushed ${Object.keys(authProfiles.profiles).length} profile(s) to gateway (with callback)`);
    }
  } catch (err) {
    console.error("[auth-sync] pushAuthProfilesToGateway failed:", err);
  }
}

/**
 * Clear auth-profiles on user's gateway on logout
 * Server → POST gateway_url/hooks/sync-auth-profiles { authProfiles: { empty } }
 * Non-blocking, logs errors
 */
export async function clearAuthProfilesViaGateway(userId: string): Promise<void> {
  try {
    const user = await getUserById(userId);
    const hooksToken = user?.gateway_hooks_token || user?.gateway_token;
    if (!user?.gateway_url || !hooksToken) {
      return;
    }

    const emptyProfiles = { version: 1, profiles: {}, lastGood: {} };
    const ok = await callGatewayHook(
      user.gateway_url,
      hooksToken,
      "sync-auth-profiles",
      { authProfiles: emptyProfiles },
    );

    if (ok) {
      console.log("[auth-sync] Cleared auth-profiles on gateway");
    }
  } catch (err) {
    console.error("[auth-sync] clearAuthProfilesViaGateway failed:", err);
  }
}
