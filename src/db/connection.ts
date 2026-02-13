/**
 * Operis Database Connection Module
 * PostgreSQL connection pool and utilities
 */

import pg from "pg";

const { Pool } = pg;

// Environment configuration
export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  poolSize?: number;
}

function resolveConfig(): DatabaseConfig {
  // Debug: Log env vars at startup
  console.log("[db] Loading config from env:", {
    DB_HOST: process.env.DB_HOST || "NOT SET (using 127.0.0.1)",
    DB_PORT: process.env.DB_PORT || "NOT SET (using 5432)",
    DB_NAME: process.env.DB_NAME || "NOT SET (using operisagent)",
    DB_USER: process.env.DB_USER || "NOT SET (using postgres)",
    DB_PASSWORD: process.env.DB_PASSWORD ? "***SET***" : "NOT SET (empty)",
    DB_PASSWORD_TYPE: typeof process.env.DB_PASSWORD,
  });

  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "operisagent",
    user: process.env.DB_USER || "duc",
    // Ensure password is always a string
    password: String(process.env.DB_PASSWORD || "080103"),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    poolSize: parseInt(process.env.DB_POOL_MAX || "200", 10),
  };
}

// Singleton pool instance
let pool: pg.Pool | null = null;

/**
 * Get or create the database connection pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const config = resolveConfig();
    pool = new Pool({
      connectionString: config.connectionString,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    pool.on("error", (err: Error) => {
      console.error("[db] Unexpected pool error:", err);
    });

    pool.on("connect", () => {
      console.debug("[db] New client connected to pool");
    });
  }

  return pool;
}

/**
 * Execute a query with parameters
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;

  if (duration > 1000) {
    console.warn(`[db] Slow query (${duration}ms):`, text.slice(0, 100));
  }

  return result;
}

/**
 * Execute a query and return first row
 */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connection health
 */
export async function checkHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await query("SELECT 1");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

/**
 * Close the database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const schemaDir = path.join(__dirname, "schema");

  // Create migrations tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Get applied migrations
  const applied = await queryAll<{ name: string }>("SELECT name FROM _migrations ORDER BY id");
  const appliedSet = new Set(applied.map((m) => m.name));

  // Read schema files
  const files = fs
    .readdirSync(schemaDir)
    .filter((f: string) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[db] Migration already applied: ${file}`);
      continue;
    }

    console.log(`[db] Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(schemaDir, file), "utf-8");

    await transaction(async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
    });

    console.log(`[db] Migration applied: ${file}`);
  }
}

export default {
  getPool,
  query,
  queryOne,
  queryAll,
  transaction,
  checkHealth,
  closePool,
  runMigrations,
};
