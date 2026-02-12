/**
 * Cron Controller
 * Handles HTTP requests for cronjob management
 */

import type { Request, Response } from "express";
import { cronService } from "../services/cron.service";

class CronController {
  /**
   * List user's cronjobs
   * GET /cron
   */
  async list(req: Request, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const enabled = req.query.enabled === "true" ? true : req.query.enabled === "false" ? false : undefined;
    const boxId = req.query.boxId as string | undefined;

    const result = await cronService.listCronjobs(req.user!.userId, {
      boxId,
      enabled,
      limit,
      offset,
    });

    res.json({
      cronjobs: result.cronjobs,
      total: result.total,
    });
  }

  /**
   * Get single cronjob
   * GET /cron/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    const cronjob = await cronService.getCronjob(req.user!.userId, req.params.id);
    res.json(cronjob);
  }

  /**
   * Create new cronjob (Moltbot-compatible)
   * POST /cron
   */
  async create(req: Request, res: Response): Promise<void> {
    const {
      box_id,
      agent_id,
      name,
      description,
      schedule_type,
      schedule_expr,
      schedule_tz,
      schedule_interval_ms,
      schedule_at_ms,
      schedule_anchor_ms,
      session_target,
      wake_mode,
      payload_kind,
      message,
      model,
      thinking,
      timeout_seconds,
      allow_unsafe_external_content,
      deliver,
      channel,
      to_recipient,
      best_effort_deliver,
      isolation_post_to_main_prefix,
      isolation_post_to_main_mode,
      isolation_post_to_main_max_chars,
      enabled,
      delete_after_run,
      metadata,
    } = req.body;

    const cronjob = await cronService.createCronjob(req.user!.userId, {
      box_id,
      agent_id,
      name,
      description,
      schedule_type,
      schedule_expr,
      schedule_tz,
      schedule_interval_ms,
      schedule_at_ms,
      schedule_anchor_ms,
      session_target,
      wake_mode,
      payload_kind,
      message,
      model,
      thinking,
      timeout_seconds,
      allow_unsafe_external_content,
      deliver,
      channel,
      to_recipient,
      best_effort_deliver,
      isolation_post_to_main_prefix,
      isolation_post_to_main_mode,
      isolation_post_to_main_max_chars,
      enabled,
      delete_after_run,
      metadata,
    });

    res.status(201).json(cronjob);
  }

  /**
   * Update cronjob (Moltbot-compatible)
   * PATCH /cron/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    const {
      agent_id,
      name,
      description,
      schedule_type,
      schedule_expr,
      schedule_tz,
      schedule_interval_ms,
      schedule_at_ms,
      schedule_anchor_ms,
      session_target,
      wake_mode,
      payload_kind,
      message,
      model,
      thinking,
      timeout_seconds,
      allow_unsafe_external_content,
      deliver,
      channel,
      to_recipient,
      best_effort_deliver,
      isolation_post_to_main_prefix,
      isolation_post_to_main_mode,
      isolation_post_to_main_max_chars,
      enabled,
      delete_after_run,
      metadata,
    } = req.body;

    const cronjob = await cronService.updateCronjob(req.user!.userId, req.params.id, {
      agent_id,
      name,
      description,
      schedule_type,
      schedule_expr,
      schedule_tz,
      schedule_interval_ms,
      schedule_at_ms,
      schedule_anchor_ms,
      session_target,
      wake_mode,
      payload_kind,
      message,
      model,
      thinking,
      timeout_seconds,
      allow_unsafe_external_content,
      deliver,
      channel,
      to_recipient,
      best_effort_deliver,
      isolation_post_to_main_prefix,
      isolation_post_to_main_mode,
      isolation_post_to_main_max_chars,
      enabled,
      delete_after_run,
      metadata,
    });

    res.json(cronjob);
  }

  /**
   * Delete cronjob
   * DELETE /cron/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    await cronService.deleteCronjob(req.user!.userId, req.params.id);
    res.status(204).send();
  }

  /**
   * Toggle cronjob enabled status
   * POST /cron/:id/toggle
   */
  async toggle(req: Request, res: Response): Promise<void> {
    const enabled = req.body.enabled === true;
    const cronjob = await cronService.toggleCronjob(req.user!.userId, req.params.id, enabled);
    res.json(cronjob);
  }

  /**
   * Run cronjob manually
   * POST /cron/:id/run
   */
  async run(req: Request, res: Response): Promise<void> {
    const execution = await cronService.runCronjobNow(req.user!.userId, req.params.id);
    res.json(execution);
  }

  /**
   * Get cronjob execution history
   * GET /cron/:id/executions
   */
  async executions(req: Request, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await cronService.getExecutions(req.user!.userId, req.params.id, {
      limit,
      offset,
    });

    res.json({
      executions: result.executions,
      total: result.total,
    });
  }

  /**
   * Validate cron schedule
   * POST /cron/validate
   */
  async validate(req: Request, res: Response): Promise<void> {
    const { schedule } = req.body;
    const isValid = cronService.isValidCronSchedule(schedule);
    const nextRun = isValid ? cronService.calculateNextRun(schedule) : null;

    res.json({
      valid: isValid,
      nextRun,
    });
  }

  /**
   * Get scheduler status (admin only)
   * GET /cron/scheduler/status
   */
  async schedulerStatus(req: Request, res: Response): Promise<void> {
    const status = cronService.getSchedulerStatus();
    res.json(status);
  }

  /**
   * Admin: List all cronjobs from all users
   * GET /cron/admin/all
   */
  async listAll(req: Request, res: Response): Promise<void> {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const enabled = req.query.enabled === "true" ? true : req.query.enabled === "false" ? false : undefined;
    const userId = req.query.userId as string | undefined;

    const result = await cronService.listAllCronjobs({
      userId,
      enabled,
      limit,
      offset,
    });

    res.json({
      cronjobs: result.cronjobs,
      total: result.total,
    });
  }
}

export const cronController = new CronController();
