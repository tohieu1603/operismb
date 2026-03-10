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
  zaloRoutes,
  tunnelRoutes,
  productRoutes,
  orderRoutes,
  reviewRoutes,
  questionRoutes,
  feedbackRoutes,
  cartRoutes,
  postRoutes,
  postCategoryRoutes,
  postTagRoutes,
  postAuthorRoutes,
  mediaRoutes,
  keywordRoutes,
  seoRoutes,
  redirectRoutes,
  pageContentRoutes,
  dictionaryRoutes,
  postAnalyticsRoutes,
} from "./routes/index";
import { errorMiddleware } from "./middleware/index";

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
operisRouter.use("/zalo", zaloRoutes);
operisRouter.use("/tunnels", tunnelRoutes);
operisRouter.use("/products", productRoutes);
operisRouter.use("/orders", orderRoutes);
operisRouter.use("/feedback", feedbackRoutes);
operisRouter.use("/cart", cartRoutes);
operisRouter.use("/", reviewRoutes);
operisRouter.use("/", questionRoutes);

// Post system routes
operisRouter.use("/posts", postRoutes);
operisRouter.use("/post-categories", postCategoryRoutes);
operisRouter.use("/post-tags", postTagRoutes);
operisRouter.use("/post-authors", postAuthorRoutes);
operisRouter.use("/media", mediaRoutes);
operisRouter.use("/keywords", keywordRoutes);
operisRouter.use("/seo", seoRoutes);
operisRouter.use("/redirects", redirectRoutes);
operisRouter.use("/page-content", pageContentRoutes);
operisRouter.use("/dictionary", dictionaryRoutes);
operisRouter.use("/post-analytics", postAnalyticsRoutes);

// Global error handler - must be last
operisRouter.use(errorMiddleware);

export default operisRouter;
