/**
 * Cron Service - Scheduler and Runner
 * - Schedules and runs cronjobs for users
 * - Calls user's Moltbot gateway to execute tasks
 */

import { CronExpressionParser } from "cron-parser";
import cronjobsRepo from "../db/models/cronjobs.js";
import { usersRepo } from "../db/index.js";
import { Errors } from "../core/errors/api-error.js";
import { analyticsService } from "./analytics.service.js";
import type {
  Cronjob,
  CronjobCreate,
  CronjobUpdate,
  CronjobExecution,
} from "../db/models/types.js";

// Config
const SCHEDULER_INTERVAL_MS = 60_000; // Check every minute
const EXECUTION_TIMEOUT_MS = 120_000; // 2 minute timeout

// Scheduler state
let schedulerTimer: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Calculate next run time from cron schedule
 */
function calculateNextRun(schedule: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(schedule);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Validate cron schedule
 */
function isValidCronSchedule(schedule: string): boolean {
  try {
    CronExpressionParser.parse(schedule);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new cronjob
 */
async function createCronjob(
  userId: string,
  data: Omit<CronjobCreate, "customer_id">,
): Promise<Cronjob> {
  // Validate schedule
  if (!isValidCronSchedule(data.schedule)) {
    throw Errors.badRequest("Invalid cron schedule format");
  }

  // Calculate next run time
  const nextRunAt = calculateNextRun(data.schedule);

  const cronjob = await cronjobsRepo.createCronjob({
    ...data,
    customer_id: userId,
    next_run_at: nextRunAt ?? undefined,
  });

  return cronjob;
}

/**
 * Get cronjob by ID (with ownership check)
 */
async function getCronjob(userId: string, cronjobId: string): Promise<Cronjob> {
  const cronjob = await cronjobsRepo.getCronjobById(cronjobId);
  if (!cronjob) {
    throw Errors.notFound("Cronjob");
  }
  if (cronjob.customer_id !== userId) {
    throw Errors.forbidden("You don't have access to this cronjob");
  }
  return cronjob;
}

/**
 * Update cronjob
 */
async function updateCronjob(
  userId: string,
  cronjobId: string,
  data: CronjobUpdate,
): Promise<Cronjob> {
  // Check ownership
  await getCronjob(userId, cronjobId);

  // If schedule changed, recalculate next run
  let nextRunAt: Date | null | undefined;
  if (data.schedule) {
    if (!isValidCronSchedule(data.schedule)) {
      throw Errors.badRequest("Invalid cron schedule format");
    }
    nextRunAt = calculateNextRun(data.schedule);
  }

  // If disabling job, clear next_run_at
  if (data.enabled === false) {
    nextRunAt = null;
  }

  const updated = await cronjobsRepo.updateCronjob(cronjobId, {
    ...data,
    next_run_at: nextRunAt,
  });

  if (!updated) {
    throw Errors.notFound("Cronjob");
  }

  return updated;
}

/**
 * Delete cronjob
 */
async function deleteCronjob(userId: string, cronjobId: string): Promise<void> {
  // Check ownership
  await getCronjob(userId, cronjobId);

  const deleted = await cronjobsRepo.deleteCronjob(cronjobId);
  if (!deleted) {
    throw Errors.notFound("Cronjob");
  }
}

/**
 * List user's cronjobs
 */
async function listCronjobs(
  userId: string,
  options?: {
    boxId?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<{ cronjobs: Cronjob[]; total: number }> {
  return cronjobsRepo.listCronjobsByCustomer(userId, options);
}

/**
 * Admin: List all cronjobs
 */
async function listAllCronjobs(options?: {
  userId?: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  cronjobs: (Cronjob & { user_email?: string; user_name?: string })[];
  total: number;
}> {
  return cronjobsRepo.listAllCronjobs(options);
}

/**
 * Toggle cronjob enabled status
 */
async function toggleCronjob(
  userId: string,
  cronjobId: string,
  enabled: boolean,
): Promise<Cronjob> {
  // Check ownership
  await getCronjob(userId, cronjobId);

  const updated = await cronjobsRepo.toggleCronjob(cronjobId, enabled);
  if (!updated) {
    throw Errors.notFound("Cronjob");
  }

  return updated;
}

/**
 * Get cronjob execution history
 */
async function getExecutions(
  userId: string,
  cronjobId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ executions: CronjobExecution[]; total: number }> {
  // Check ownership
  await getCronjob(userId, cronjobId);

  return cronjobsRepo.listExecutionsByCronjob(cronjobId, options);
}

// ============================================================================
// Runner - Execute cronjob by calling user's gateway
// ============================================================================

/**
 * Execute a single cronjob
 */
async function executeCronjob(cronjob: Cronjob): Promise<CronjobExecution> {
  // Start execution record
  const execution = await cronjobsRepo.startCronjobRun(cronjob.id);

  try {
    // Get user's gateway config
    const user = await usersRepo.getUserById(cronjob.customer_id);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.gateway_url || !user.gateway_token) {
      throw new Error("Gateway not configured for user");
    }

    // Build the message to send to gateway
    const message = cronjob.task || cronjob.action;

    // Call gateway's chat endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

    try {
      const response = await fetch(`${user.gateway_url}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.gateway_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "user", content: message }],
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gateway error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const output = result.choices?.[0]?.message?.content || JSON.stringify(result);

      // Extract token usage from response
      const usage = result.usage || {};
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || inputTokens + outputTokens;

      // Record token usage for analytics
      if (totalTokens > 0) {
        await analyticsService.recordUsage({
          user_id: cronjob.customer_id,
          request_type: "cronjob",
          request_id: cronjob.id,
          model: result.model || "claude-sonnet-4-20250514",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          cost_tokens: totalTokens,
          metadata: {
            cronjob_name: cronjob.name,
            execution_id: execution.id,
          },
        });
      }

      // Mark execution as success
      const completed = await cronjobsRepo.completeExecution(execution.id, {
        status: "success",
        output,
      });

      // Update next run time
      const nextRun = calculateNextRun(cronjob.schedule);
      if (nextRun) {
        await cronjobsRepo.updateCronjob(cronjob.id, { next_run_at: nextRun });
      }

      return completed!;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    // Mark execution as failure
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const completed = await cronjobsRepo.completeExecution(execution.id, {
      status: "failure",
      error: errorMessage,
    });

    // Still update next run time even on failure
    const nextRun = calculateNextRun(cronjob.schedule);
    if (nextRun) {
      await cronjobsRepo.updateCronjob(cronjob.id, { next_run_at: nextRun });
    }

    return completed!;
  }
}

/**
 * Run a cronjob manually (force run)
 */
async function runCronjobNow(
  userId: string,
  cronjobId: string,
): Promise<CronjobExecution> {
  const cronjob = await getCronjob(userId, cronjobId);
  return executeCronjob(cronjob);
}

// ============================================================================
// Scheduler - Background process to check and run due cronjobs
// ============================================================================

/**
 * Process due cronjobs
 */
async function processDueCronjobs(): Promise<void> {
  if (isRunning) return; // Prevent overlapping runs

  isRunning = true;
  try {
    const dueJobs = await cronjobsRepo.getDueCronjobs(50);

    for (const job of dueJobs) {
      try {
        await executeCronjob(job);
        console.log(`[Cron] Executed job: ${job.name} (${job.id})`);
      } catch (error) {
        console.error(`[Cron] Failed to execute job ${job.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[Cron] Scheduler error:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduler
 */
function startScheduler(): void {
  if (schedulerTimer) {
    console.log("[Cron] Scheduler already running");
    return;
  }

  console.log("[Cron] Starting scheduler...");
  schedulerTimer = setInterval(processDueCronjobs, SCHEDULER_INTERVAL_MS);

  // Run immediately on start
  processDueCronjobs();
}

/**
 * Stop the scheduler
 */
function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[Cron] Scheduler stopped");
  }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus(): { running: boolean; interval: number } {
  return {
    running: schedulerTimer !== null,
    interval: SCHEDULER_INTERVAL_MS,
  };
}

export const cronService = {
  // CRUD
  createCronjob,
  getCronjob,
  updateCronjob,
  deleteCronjob,
  listCronjobs,
  listAllCronjobs,
  toggleCronjob,
  getExecutions,
  // Runner
  runCronjobNow,
  executeCronjob,
  // Scheduler
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  // Utilities
  isValidCronSchedule,
  calculateNextRun,
};
