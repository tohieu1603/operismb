/**
 * Zalo Service
 * Handles QR login flow via zca-js, manages sessions and credentials.
 * Syncs credentials to gateway via HTTP hook (supports remote gateway).
 */

import { Zalo } from "zca-js";
import {
  upsertUserChannel,
  getUserChannel,
  listUserChannels,
  disconnectUserChannel,
} from "../db/models/user-channels";
import { recordUsage } from "../db/models/token-usage";
import { debitTokens } from "../db/models/token-transactions";
import { getUserById } from "../db/models/users";
import type { RequestType } from "../db/models/types";

/** In-memory QR login sessions */
const sessions = new Map<string, ZaloLoginSession>();

interface ZaloLoginSession {
  userId: string;
  status: "pending" | "qr_ready" | "scanned" | "success" | "error";
  qrBase64: string | null;
  zaloUid: string | null;
  zaloName: string | null;
  error: string | null;
  createdAt: number;
}

function generateToken(): string {
  return `zls_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Remove sessions older than 5 minutes */
function cleanExpired() {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (now - s.createdAt > 5 * 60 * 1000) sessions.delete(key);
  }
}

/** Sync credentials to gateway via HTTP hook (works for both local and remote gateway) */
async function syncCredentialsToGateway(
  userId: string,
  credentials: Record<string, unknown>,
  accountLabel: string = "default",
): Promise<void> {
  const user = await getUserById(userId);
  if (!user?.gateway_url) {
    console.warn("[zalo] No gateway_url configured, skipping credential sync");
    return;
  }
  const token = user.gateway_hooks_token || user.gateway_token || "";
  console.log(`[zalo] syncCreds: userId=${userId} email=${(user as any).email} url=${user.gateway_url} hooks_token=${user.gateway_hooks_token ?? "null"} gw_token=${user.gateway_token ? user.gateway_token.slice(0, 8) + "..." : "null"} using=${token.slice(0, 8)}...`);
  const url = `${user.gateway_url}/hooks/sync-credentials`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "zalozcajs", accountId: accountLabel, action: "sync", credentials }),
    });
    if (!res.ok) console.warn(`[zalo] sync-credentials hook returned ${res.status}`);
    else console.log(`[zalo] Credentials synced to gateway (${accountLabel})`);
  } catch (err) {
    console.warn(`[zalo] sync-credentials hook failed: ${err instanceof Error ? err.message : err}`);
  }
}

/** Remove credentials from gateway via HTTP hook */
async function removeCredentialsFromGateway(
  userId: string,
  accountLabel: string = "default",
): Promise<void> {
  const user = await getUserById(userId);
  if (!user?.gateway_url) return;
  const token = user.gateway_hooks_token || user.gateway_token || "";
  const url = `${user.gateway_url}/hooks/sync-credentials`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "zalozcajs", accountId: accountLabel, action: "remove" }),
    });
    if (!res.ok) console.warn(`[zalo] remove-credentials hook returned ${res.status}`);
    else console.log(`[zalo] Credentials removed from gateway (${accountLabel})`);
  } catch (err) {
    console.warn(`[zalo] remove-credentials hook failed: ${err instanceof Error ? err.message : err}`);
  }
}

class ZaloService {
  /** Start QR login — returns session token for polling */
  startLogin(userId: string): { sessionToken: string } {
    cleanExpired();
    const sessionToken = generateToken();
    const session: ZaloLoginSession = {
      userId,
      status: "pending",
      qrBase64: null,
      zaloUid: null,
      zaloName: null,
      error: null,
      createdAt: Date.now(),
    };
    sessions.set(sessionToken, session);
    void this.runLoginFlow(sessionToken, session);
    return { sessionToken };
  }

  /** Poll login status */
  getStatus(sessionToken: string) {
    const s = sessions.get(sessionToken);
    if (!s) return null;
    const result = {
      status: s.status,
      qrBase64: s.qrBase64,
      zaloUid: s.zaloUid,
      zaloName: s.zaloName,
      error: s.error,
    };
    // Clean up completed sessions after read
    if (s.status === "success" || s.status === "error") {
      sessions.delete(sessionToken);
    }
    return result;
  }

  /** Get channel info for a user */
  async getChannel(userId: string) {
    const ch = await getUserChannel(userId);
    if (!ch) return { connected: false };
    return {
      connected: ch.is_connected,
      zaloUid: ch.zalo_uid,
      zaloName: ch.zalo_name,
      connectedAt: ch.connected_at,
    };
  }

  /** List all channels for a user */
  async listChannels(userId: string) {
    const channels = await listUserChannels(userId);
    return channels.map((ch) => ({
      id: ch.id,
      channel: ch.channel,
      accountLabel: ch.account_label,
      connected: ch.is_connected,
      zaloUid: ch.zalo_uid,
      zaloName: ch.zalo_name,
      connectedAt: ch.connected_at,
    }));
  }

  /** Disconnect channel — removes credentials from gateway too */
  async disconnect(userId: string, accountLabel: string = "default") {
    const result = await disconnectUserChannel(userId);
    if (result) {
      await removeCredentialsFromGateway(userId, accountLabel);
    }
    return { disconnected: !!result };
  }

  /** Record token usage from OpenClaw webhook */
  async recordTokenUsage(data: {
    userId: string;
    inputTokens: number;
    outputTokens: number;
    model?: string;
    requestType?: RequestType;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const totalTokens = data.inputTokens + data.outputTokens;

    // Record usage
    const usage = await recordUsage({
      user_id: data.userId,
      request_type: data.requestType ?? "chat",
      request_id: data.requestId,
      model: data.model,
      input_tokens: data.inputTokens,
      output_tokens: data.outputTokens,
      total_tokens: totalTokens,
      cost_tokens: totalTokens,
      metadata: data.metadata ?? {},
    });

    // Debit from user's token balance
    let balanceAfter: number | null = null;
    try {
      const result = await debitTokens(
        data.userId,
        totalTokens,
        `Zalo chat: ${data.model ?? "unknown"} (${data.inputTokens}in/${data.outputTokens}out)`,
        usage.id,
      );
      balanceAfter = result.user.token_balance;
    } catch (err) {
      console.warn(`[zalo] Failed to debit tokens for user ${data.userId}: ${err}`);
    }

    return { usage, balanceAfter };
  }

  /** Check if user has enough tokens */
  async checkBalance(userId: string, requiredTokens: number = 0) {
    const user = await getUserById(userId);
    if (!user) return { hasBalance: false, balance: 0, userId };
    return {
      hasBalance: requiredTokens > 0 ? user.token_balance >= requiredTokens : user.token_balance > 0,
      balance: user.token_balance,
      userId,
    };
  }

  /** Internal: run zca-js QR login flow in background */
  private async runLoginFlow(_sessionToken: string, session: ZaloLoginSession) {
    try {
      const zalo = new Zalo({ logging: false });

      let capturedCreds: Record<string, unknown> | null = null;

      const api = await zalo.loginQR({}, (event: unknown) => {
        if (!event || typeof event !== "object") return;
        const ev = event as {
          data?: Record<string, unknown>;
          actions?: Record<string, unknown>;
        };

        // QRCodeGenerated: extract base64 image
        if (ev.data && (ev.data as Record<string, unknown>).image) {
          const image = String((ev.data as Record<string, unknown>).image);
          session.qrBase64 = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
          session.status = "qr_ready";
        }

        // GotLoginInfo: capture ALL credential fields (imei, cookie, userAgent, zpw_enk, etc.)
        if (ev.data) {
          const d = ev.data as Record<string, unknown>;
          if (d.imei && d.cookie && d.userAgent) {
            console.log(`[zalo] GotLoginInfo keys: ${Object.keys(d).join(", ")}`);
            capturedCreds = { ...d };
            session.status = "scanned";
          }
        }
      });

      // Get self info
      let zaloUid: string | null = null;
      let zaloName: string | null = null;
      try {
        const ctx = (api as unknown as Record<string, unknown>).context as Record<string, unknown> | undefined;
        zaloUid = ctx?.uid ? String(ctx.uid) : null;
        if (zaloUid) {
          const info = await api.getUserInfo(zaloUid);
          const profiles = ((info as Record<string, unknown>)?.changed_profiles ?? {}) as Record<string, Record<string, unknown>>;
          const profile = profiles[zaloUid];
          zaloName = profile?.displayName ? String(profile.displayName) : null;
        }
      } catch { /* non-critical */ }

      // Save to DB
      if (capturedCreds) {
        await upsertUserChannel({
          user_id: session.userId,
          channel: "zalozcajs",
          zalo_uid: zaloUid,
          zalo_name: zaloName,
          credentials: capturedCreds as unknown as Record<string, unknown>,
          is_connected: true,
        });

        // Sync credentials to gateway via HTTP hook
        await syncCredentialsToGateway(session.userId, capturedCreds as unknown as Record<string, unknown>);
      }

      session.zaloUid = zaloUid;
      session.zaloName = zaloName;
      session.status = "success";

      try { api.listener.stop(); } catch { /* ignore */ }
    } catch (err) {
      session.status = "error";
      session.error = err instanceof Error ? err.message : String(err);
    }
  }
}

export const zaloService = new ZaloService();
