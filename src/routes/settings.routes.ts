/**
 * Settings Routes
 * System configuration endpoints
 */

import { Router } from "express";
import { getSettings, saveSettings } from "../controllers/settings.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// All settings endpoints require admin auth
router.get("/", authMiddleware, adminMiddleware, getSettings);
router.post("/", authMiddleware, adminMiddleware, saveSettings);

export const settingsRoutes = router;
export default router;
