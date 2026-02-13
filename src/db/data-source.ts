/**
 * TypeORM DataSource Configuration
 * Replaces raw pg pool for model operations
 */

import "reflect-metadata";
import { DataSource } from "typeorm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "operisagent",
  username: process.env.DB_USER || "duc",
  password: String(process.env.DB_PASSWORD || "080103"),
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: process.env.DB_LOGGING === "true",
  entities: [join(__dirname, "/entities/*.entity.{ts,js}")],
  poolSize: parseInt(process.env.DB_POOL_MAX || "200", 10),
});
