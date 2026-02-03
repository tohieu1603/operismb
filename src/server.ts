/**
 * Operis API - Standalone Express Server
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { operisRouter } from "./index.js";
import { allowHostsMiddleware } from "./middleware/allow-hosts.middleware.js";
import { getPool, runMigrations } from "./db/connection.js";
import openaiCompatRoutes from "./routes/openai-compat.routes.js";
import anthropicCompatRoutes from "./routes/anthropic-compat.routes.js";

const PORT = parseInt(process.env.PORT || "3025", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Read allowed origins from environment for CORS
const ALLOWED_ORIGINS = (process.env.ALLOWED_HOSTS || "localhost,127.0.0.1")
  .split(",")
  .map((h) => h.trim())
  .flatMap((h) => [`http://${h}`, `https://${h}`, `http://${h}:*`, `https://${h}:*`]);

async function main() {
  // Initialize database
  console.log("[server] Initializing database...");
  getPool(); // Initialize pool
  await runMigrations();
  console.log("[server] Database ready");

  const app = express();

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
          if (allowed.includes("*")) {
            const pattern = allowed.replace("*", "\\d+");
            return new RegExp(pattern).test(origin);
          }
          return origin.startsWith(allowed);
        });
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(allowHostsMiddleware);

  // Health check at root
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API routes
  app.use("/api", operisRouter);

  // OpenAI-compatible endpoint for Moltbot integration
  app.use("/v1", openaiCompatRoutes);

  // Anthropic-compatible endpoint (drop-in replacement for api.anthropic.com)
  app.use("/v1", anthropicCompatRoutes);

  app.listen(PORT, HOST, () => {
    console.log(`[server] Operis API running at http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
