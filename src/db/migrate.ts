/**
 * Database Migration Runner
 */
import { runMigrations, closePool } from "./connection.js";

async function main() {
  console.log("[migrate] Starting migrations...");
  try {
    await runMigrations();
    console.log("[migrate] Migrations completed successfully");
  } catch (error) {
    console.error("[migrate] Migration failed:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
