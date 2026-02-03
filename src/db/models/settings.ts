/**
 * Settings Repository
 * CRUD operations for system settings
 */

import { query, queryOne } from "../connection.js";

export interface SystemSetting {
  key: string;
  value: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get a setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const result = await queryOne<SystemSetting>("SELECT * FROM settings WHERE key = $1", [key]);
  return result?.value ?? null;
}

/**
 * Get multiple settings by keys
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const result = await query<SystemSetting>(
    `SELECT * FROM settings WHERE key IN (${placeholders})`,
    keys,
  );

  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

/**
 * Set a setting (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value],
  );
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
  await query("DELETE FROM settings WHERE key = $1", [key]);
}

export const settingsRepo = {
  getSetting,
  getSettings,
  setSetting,
  setSettings,
  deleteSetting,
};

export default settingsRepo;
