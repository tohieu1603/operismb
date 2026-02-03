/**
 * Settings Controller
 * Handle settings API requests
 */

import type { Request, Response, NextFunction } from "express";
import { settingsService } from "../services/settings.service.js";

/**
 * Get system settings
 */
export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingsService.getSettings();

    // Mask API keys for response
    const maskedProviders = settings.providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? maskApiKey(p.apiKey) : "",
    }));

    res.json({
      ...settings,
      providers: maskedProviders,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save system settings
 */
export async function saveSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { defaultProvider, defaultModel, providers } = req.body;

    const result = await settingsService.saveSettings({
      defaultProvider,
      defaultModel,
      providers: providers || [],
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Mask API key for display
 */
function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
