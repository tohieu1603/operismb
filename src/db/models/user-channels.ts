/**
 * User Channels Repository
 * CRUD for user_channels table (Zalo and future channel connections)
 */

import { AppDataSource } from "../data-source";
import { UserChannelEntity } from "../entities/user-channel.entity";

function getRepo() {
  return AppDataSource.getRepository(UserChannelEntity);
}

export async function upsertUserChannel(data: {
  user_id: string;
  channel?: string;
  account_label?: string;
  zalo_uid?: string | null;
  zalo_name?: string | null;
  credentials?: Record<string, unknown> | null;
  is_connected?: boolean;
}): Promise<UserChannelEntity> {
  const channel = data.channel ?? "zalozcajs";
  const accountLabel = data.account_label ?? "default";

  const existing = await getRepo().findOneBy({
    user_id: data.user_id,
    channel,
    account_label: accountLabel,
  });

  if (existing) {
    existing.zalo_uid = data.zalo_uid ?? existing.zalo_uid;
    existing.zalo_name = data.zalo_name ?? existing.zalo_name;
    existing.credentials = data.credentials ?? existing.credentials;
    existing.is_connected = data.is_connected ?? existing.is_connected;
    if (data.is_connected) existing.connected_at = new Date();
    return await getRepo().save(existing);
  }

  const entity = getRepo().create({
    user_id: data.user_id,
    channel,
    account_label: accountLabel,
    zalo_uid: data.zalo_uid ?? null,
    zalo_name: data.zalo_name ?? null,
    credentials: data.credentials ?? null,
    is_connected: data.is_connected ?? false,
    connected_at: data.is_connected ? new Date() : null,
  });
  return await getRepo().save(entity);
}

export async function getUserChannel(
  userId: string,
  channel = "zalozcajs",
  accountLabel = "default",
): Promise<UserChannelEntity | null> {
  return getRepo().findOneBy({ user_id: userId, channel, account_label: accountLabel });
}

export async function listUserChannels(userId: string): Promise<UserChannelEntity[]> {
  return getRepo().find({ where: { user_id: userId }, order: { created_at: "ASC" } });
}

export async function disconnectUserChannel(
  userId: string,
  channel = "zalozcajs",
  accountLabel = "default",
): Promise<UserChannelEntity | null> {
  const entity = await getRepo().findOneBy({ user_id: userId, channel, account_label: accountLabel });
  if (!entity) return null;
  entity.is_connected = false;
  entity.credentials = null;
  return await getRepo().save(entity);
}

export default {
  upsertUserChannel,
  getUserChannel,
  listUserChannels,
  disconnectUserChannel,
};
