/**
 * Settings Service
 * Manage system configuration including AI providers
 */

import { settingsRepo } from "../db/models/settings.js";

export interface ProviderSettings {
  id: string;
  apiKey: string;
}

export interface SystemSettings {
  defaultProvider: string;
  defaultModel: string;
  providers: ProviderSettings[];
}

export interface SystemSettingsInput {
  defaultProvider: string;
  defaultModel: string;
  providers: ProviderSettings[];
}

// Settings keys
const SETTINGS_KEYS = {
  DEFAULT_PROVIDER: "ai.default_provider",
  DEFAULT_MODEL: "ai.default_model",
  PROVIDER_PREFIX: "ai.provider.",
};

class SettingsService {
  /**
   * Get all AI settings
   */
  async getSettings(): Promise<SystemSettings> {
    const keys = [SETTINGS_KEYS.DEFAULT_PROVIDER, SETTINGS_KEYS.DEFAULT_MODEL];
    const providerIds = ["anthropic", "openai", "deepseek", "mimo", "google", "groq"];

    // Add provider keys
    for (const id of providerIds) {
      keys.push(`${SETTINGS_KEYS.PROVIDER_PREFIX}${id}`);
    }

    const settings = await settingsRepo.getSettings(keys);

    // Parse providers
    const providers: ProviderSettings[] = providerIds.map((id) => ({
      id,
      apiKey: settings[`${SETTINGS_KEYS.PROVIDER_PREFIX}${id}`] || "",
    }));

    return {
      defaultProvider: settings[SETTINGS_KEYS.DEFAULT_PROVIDER] || "anthropic",
      defaultModel: settings[SETTINGS_KEYS.DEFAULT_MODEL] || "claude-sonnet-4-20250514",
      providers,
    };
  }

  /**
   * Save AI settings
   */
  async saveSettings(input: SystemSettingsInput): Promise<{ success: boolean }> {
    const settingsToSave: Record<string, string> = {
      [SETTINGS_KEYS.DEFAULT_PROVIDER]: input.defaultProvider,
      [SETTINGS_KEYS.DEFAULT_MODEL]: input.defaultModel,
    };

    // Save provider API keys (masked for security in logs)
    for (const provider of input.providers) {
      const key = `${SETTINGS_KEYS.PROVIDER_PREFIX}${provider.id}`;
      settingsToSave[key] = provider.apiKey || "";
    }

    await settingsRepo.setSettings(settingsToSave);

    return { success: true };
  }

  /**
   * Get API key for a provider
   */
  async getProviderApiKey(providerId: string): Promise<string | null> {
    return settingsRepo.getSetting(`${SETTINGS_KEYS.PROVIDER_PREFIX}${providerId}`);
  }

  /**
   * Get default provider and model
   */
  async getDefaultConfig(): Promise<{ provider: string; model: string }> {
    const settings = await settingsRepo.getSettings([
      SETTINGS_KEYS.DEFAULT_PROVIDER,
      SETTINGS_KEYS.DEFAULT_MODEL,
    ]);

    return {
      provider: settings[SETTINGS_KEYS.DEFAULT_PROVIDER] || "anthropic",
      model: settings[SETTINGS_KEYS.DEFAULT_MODEL] || "claude-sonnet-4-20250514",
    };
  }
}

export const settingsService = new SettingsService();
