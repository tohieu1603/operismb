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
const STOP_TIMEOUT_MS = 10_000; // 10 second timeout for stop command

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
// Stop Agent - Send /stop to Moltbot gateway to abort running agent
// ============================================================================

/**
 * Send /stop command to Moltbot gateway to abort any running agent for this cronjob
 * Uses the same sessionKey as executeCronjob: `cron:{cronjobId}`
 */
async function stopCronjobAgent(cronjob: Cronjob): Promise<{ stopped: boolean; error?: string }> {
  try {
    const user = await usersRepo.getUserById(cronjob.customer_id);
    if (!user?.gateway_url) {
      return { stopped: false, error: "Gateway URL not configured" };
    }

    const hooksToken = user.gateway_hooks_token || user.gateway_token;
    if (!hooksToken) {
      return { stopped: false, error: "Gateway token not configured" };
    }

    const sessionKey = `cron:${cronjob.id}`;
    console.log(`[Cron] Sending /stop to sessionKey: ${sessionKey}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STOP_TIMEOUT_MS);

    try {
      const response = await fetch(`${user.gateway_url}/hooks/wake`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hooksToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "/stop",
          sessionKey,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Cron] Stop command failed: ${response.status} - ${errorText}`);
        return { stopped: false, error: `${response.status} - ${errorText}` };
      }

      console.log(`[Cron] Stop command sent successfully for ${cronjob.name}`);
      return { stopped: true };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMsg = fetchError instanceof Error ? fetchError.message : "Unknown error";
      console.warn(`[Cron] Stop command error: ${errorMsg}`);
      return { stopped: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { stopped: false, error: errorMsg };
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
  // Validate schedule for cron type
  const scheduleType = data.schedule_type || "cron";
  if (scheduleType === "cron" && !isValidCronSchedule(data.schedule_expr)) {
    throw Errors.badRequest("Invalid cron schedule format");
  }

  // Calculate next run time based on schedule type
  let nextRunAt: Date | null = null;
  if (scheduleType === "cron") {
    nextRunAt = calculateNextRun(data.schedule_expr);
  } else if (scheduleType === "every" && data.schedule_interval_ms) {
    nextRunAt = new Date(Date.now() + data.schedule_interval_ms);
  } else if (scheduleType === "at" && data.schedule_at_ms) {
    nextRunAt = new Date(data.schedule_at_ms);
  }

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
  const existingJob = await getCronjob(userId, cronjobId);

  // If schedule changed, recalculate next run
  let nextRunAt: Date | null | undefined;
  const scheduleType = data.schedule_type || existingJob.schedule_type || "cron";

  if (data.schedule_expr) {
    if (scheduleType === "cron" && !isValidCronSchedule(data.schedule_expr)) {
      throw Errors.badRequest("Invalid cron schedule format");
    }
    if (scheduleType === "cron") {
      nextRunAt = calculateNextRun(data.schedule_expr);
    }
  }

  if (scheduleType === "every" && data.schedule_interval_ms) {
    nextRunAt = new Date(Date.now() + data.schedule_interval_ms);
  }

  if (scheduleType === "at" && data.schedule_at_ms) {
    nextRunAt = new Date(data.schedule_at_ms);
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
 * Always sends /stop to Moltbot gateway to abort any running agent
 */
async function deleteCronjob(userId: string, cronjobId: string): Promise<void> {
  // Check ownership
  const cronjob = await getCronjob(userId, cronjobId);

  // Always send stop command to abort any running agent before deleting
  // (even if disabled, there could still be a running agent from previous execution)
  await stopCronjobAgent(cronjob);

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
 * When disabling, also sends /stop to Moltbot gateway to abort any running agent
 */
async function toggleCronjob(
  userId: string,
  cronjobId: string,
  enabled: boolean,
): Promise<Cronjob> {
  // Check ownership
  const cronjob = await getCronjob(userId, cronjobId);

  // If disabling, send stop command to abort any running agent
  if (!enabled && cronjob.enabled) {
    await stopCronjobAgent(cronjob);
  }

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
// Runner - Execute cronjob by calling user's gateway /hooks/agent
// ============================================================================

/**
 * Execute a single cronjob via Moltbot gateway
 * - systemEvent: sends to /hooks/wake (main session system event)
 * - agentTurn: sends to /hooks/agent (isolated agent run)
 * Uses all Moltbot features: wakeMode, sessionKey, channel, deliver, etc.
 */
async function executeCronjob(cronjob: Cronjob): Promise<CronjobExecution> {
  const startTime = Date.now();

  // Start execution record and mark job as running
  const execution = await cronjobsRepo.startCronjobRun(cronjob.id);
  await cronjobsRepo.updateCronjob(cronjob.id, { running_at: new Date() });

  try {
    // Get user's gateway config
    const user = await usersRepo.getUserById(cronjob.customer_id);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.gateway_url) {
      throw new Error("Gateway URL not configured for user");
    }

    // Use gateway_hooks_token if available, fallback to gateway_token
    const hooksToken = user.gateway_hooks_token || user.gateway_token;
    if (!hooksToken) {
      throw new Error("Gateway hooks token not configured for user");
    }

    const sessionKey = `cron:${cronjob.id}`;
    const payloadKind = cronjob.payload_kind || "agentTurn";

    // Determine endpoint and build payload based on payload_kind
    let endpoint: string;
    let hookPayload: Record<string, unknown>;

    if (payloadKind === "systemEvent") {
      // systemEvent: use /hooks/wake for main session
      endpoint = `${user.gateway_url}/hooks/wake`;
      hookPayload = {
        text: cronjob.message,
        sessionKey,
        wakeMode: cronjob.wake_mode,
      };
    } else {
      // agentTurn: use /hooks/agent for isolated agent run
      endpoint = `${user.gateway_url}/hooks/agent`;
      hookPayload = {
        message: cronjob.message,
        name: cronjob.name,
        wakeMode: cronjob.wake_mode,
        sessionKey,
        ...(cronjob.agent_id && cronjob.agent_id !== "main" && { agentId: cronjob.agent_id }),
        ...(cronjob.model && { model: cronjob.model }),
        ...(cronjob.thinking && { thinking: cronjob.thinking }),
        ...(cronjob.timeout_seconds && { timeoutSeconds: cronjob.timeout_seconds }),
        ...(cronjob.allow_unsafe_external_content && { allowUnsafeExternalContent: true }),
        ...(cronjob.deliver !== undefined && { deliver: cronjob.deliver }),
        ...(cronjob.channel && { channel: cronjob.channel }),
        ...(cronjob.to_recipient && { to: cronjob.to_recipient }),
        ...(cronjob.best_effort_deliver && { bestEffortDeliver: true }),
        // Isolation config for isolated sessions
        ...(cronjob.session_target === "isolated" && {
          ...(cronjob.isolation_post_to_main_prefix && { postToMainPrefix: cronjob.isolation_post_to_main_prefix }),
          ...(cronjob.isolation_post_to_main_mode && { postToMainMode: cronjob.isolation_post_to_main_mode }),
          ...(cronjob.isolation_post_to_main_max_chars && { postToMainMaxChars: cronjob.isolation_post_to_main_max_chars }),
        }),
      };
    }

    console.log(`[Cron] Executing job ${cronjob.name} via ${payloadKind === "systemEvent" ? "/hooks/wake" : "/hooks/agent"}`);
    console.log(`[Cron] Payload:`, JSON.stringify(hookPayload, null, 2));

    // Call gateway endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hooksToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hookPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gateway hooks error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Build output message based on response
      const output = result.ok
        ? result.runId
          ? `Queued with runId: ${result.runId}`
          : "Executed successfully"
        : JSON.stringify(result);

      if (result.runId) {
        console.log(`[Cron] Job ${cronjob.name} queued: runId=${result.runId}`);
      } else {
        console.log(`[Cron] Job ${cronjob.name} executed successfully`);
      }

      const durationMs = Date.now() - startTime;

      // Mark execution as success
      const completed = await cronjobsRepo.completeExecution(execution.id, {
        status: "success",
        output,
      });

      // Update job state
      const nextRun = calculateNextRunForJob(cronjob);
      await cronjobsRepo.updateCronjob(cronjob.id, {
        running_at: null,
        last_status: "ok",
        last_error: undefined,
        last_duration_ms: durationMs,
        next_run_at: nextRun,
      });

      // Handle delete_after_run
      if (cronjob.delete_after_run) {
        await cronjobsRepo.deleteCronjob(cronjob.id);
        console.log(`[Cron] Job ${cronjob.name} deleted after run`);
      }

      return completed!;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Mark execution as failure
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Cron] Job ${cronjob.name} failed:`, errorMessage);

    const completed = await cronjobsRepo.completeExecution(execution.id, {
      status: "failure",
      error: errorMessage,
    });

    // Update job state with error
    const nextRun = calculateNextRunForJob(cronjob);
    await cronjobsRepo.updateCronjob(cronjob.id, {
      running_at: null,
      last_status: "error",
      last_error: errorMessage,
      last_duration_ms: durationMs,
      next_run_at: nextRun,
    });

    return completed!;
  }
}

/**
 * Calculate next run time based on schedule type
 */
function calculateNextRunForJob(cronjob: Cronjob): Date | null {
  const scheduleType = cronjob.schedule_type || "cron";

  switch (scheduleType) {
    case "cron":
      return calculateNextRun(cronjob.schedule_expr);

    case "every":
      if (cronjob.schedule_interval_ms) {
        return new Date(Date.now() + cronjob.schedule_interval_ms);
      }
      return null;

    case "at":
      // "at" type runs only once, no next run
      return null;

    default:
      return calculateNextRun(cronjob.schedule_expr);
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
  stopCronjobAgent,
  // Scheduler
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  // Utilities
  isValidCronSchedule,
  calculateNextRun,
};
