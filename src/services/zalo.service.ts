/**
 * Zalo Service
 * Handles QR login flow via zca-js, manages sessions and credentials.
 * Syncs credentials to OpenClaw gateway path after login.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
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

/** Write credentials JSON to OpenClaw gateway path */
async function syncCredentialsFile(
  credentials: Record<string, unknown>,
  accountLabel: string = "default",
): Promise<void> {
  const dir = join(homedir(), ".openclaw", "credentials", "zalozcajs");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${accountLabel}.json`);
  await writeFile(filePath, JSON.stringify(credentials, null, 2), "utf-8");
  console.log(`[zalo] Credentials synced to ${filePath}`);
}

/** Remove credentials file on disconnect */
async function removeCredentialsFile(accountLabel: string = "default"): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const filePath = join(homedir(), ".openclaw", "credentials", "zalozcajs", `${accountLabel}.json`);
  try {
    await unlink(filePath);
    console.log(`[zalo] Credentials file removed: ${filePath}`);
  } catch {
    // file may not exist
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

  /** Disconnect channel — removes credentials file too */
  async disconnect(userId: string, accountLabel: string = "default") {
    const result = await disconnectUserChannel(userId);
    if (result) {
      await removeCredentialsFile(accountLabel);
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

      let capturedCreds: { imei: string; cookie: unknown; userAgent: string } | null = null;

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

        // GotLoginInfo: capture credentials
        if (ev.data) {
          const d = ev.data as Record<string, unknown>;
          if (d.imei && d.cookie && d.userAgent) {
            capturedCreds = {
              imei: String(d.imei),
              cookie: d.cookie,
              userAgent: String(d.userAgent),
            };
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

        // Sync credentials file to OpenClaw gateway path
        await syncCredentialsFile(capturedCreds as unknown as Record<string, unknown>);
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
