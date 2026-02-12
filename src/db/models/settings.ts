/**
 * Settings Repository
 * CRUD operations for system settings (TypeORM)
 */

import { In } from "typeorm";
import { AppDataSource } from "../data-source.js";
import { SettingEntity } from "../entities/setting.entity.js";

export interface SystemSetting {
  key: string;
  value: string;
  created_at: Date;
  updated_at: Date;
}

function getRepo() {
  return AppDataSource.getRepository(SettingEntity);
}

/**
 * Get a setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const result = await getRepo().findOneBy({ key });
  return result?.value ?? null;
}

/**
 * Get multiple settings by keys
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const rows = await getRepo().findBy({ key: In(keys) });

  const settings: Record<string, string> = {};
  for (const row of rows) {
    if (row.value !== null) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

/**
 * Set a setting (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await getRepo().upsert({ key, value }, ["key"]);
}

/**
 * Set multiple settings (upsert)
 */
export async function setSettings(settings: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value);
  }
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string): Promise<void> {
  await getRepo().delete({ key });
}

export const settingsRepo = {
  getSetting,
  getSettings,
  setSetting,
  setSettings,
  deleteSetting,
};

export default settingsRepo;
