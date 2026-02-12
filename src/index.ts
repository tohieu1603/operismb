/**
 * Operis REST API
 * Express router for admin UI endpoints
 * Following Repository → Service → Controller → Routes pattern
 */

import { Router } from "express";
import {
  authRoutes,
  userRoutes,
  tokenRoutes,
  apiKeyRoutes,
  chatRoutes,
  depositRoutes,
  settingsRoutes,
  cronRoutes,
  gatewayProxyRoutes,
  gatewayRegisterRoutes,
  analyticsRoutes,
  tokenVaultRoutes,
  tunnelRoutes,
} from "./routes/index.js";
import { errorMiddleware } from "./middleware/index.js";

export const operisRouter = Router();

// Health check
operisRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
operisRouter.use("/auth", authRoutes);
operisRouter.use("/users", userRoutes);
operisRouter.use("/keys", apiKeyRoutes);
operisRouter.use("/tokens", tokenRoutes);
operisRouter.use("/chat", chatRoutes);
operisRouter.use("/deposits", depositRoutes);
operisRouter.use("/settings", settingsRoutes);
operisRouter.use("/cron", cronRoutes);
operisRouter.use("/v1/gateway", gatewayProxyRoutes);
operisRouter.use("/analytics", analyticsRoutes);
operisRouter.use("/token-vault", tokenVaultRoutes);
operisRouter.use("/gateway", gatewayRegisterRoutes);
operisRouter.use("/tunnels", tunnelRoutes);

// Global error handler - must be last
operisRouter.use(errorMiddleware);

export default operisRouter;
