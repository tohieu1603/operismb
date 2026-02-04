/**
 * Cron validators
 */

import type { ValidationResult } from "./common.validator.js";

// Cron schedule regex (basic validation - 5 or 6 fields)
const CRON_REGEX = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)(\s+(\*|[0-9,\-\/]+))?$/;

export interface CreateCronjobDTO {
  box_id: string;
  name: string;
  schedule: string;
  action: string;
  task?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateCronjobDTO {
  name?: string;
  schedule?: string;
  action?: string;
  task?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToggleCronjobDTO {
  enabled: boolean;
}

export interface ValidateScheduleDTO {
  schedule: string;
}

/**
 * Validate create cronjob request
 */
export function validateCreateCronjob(body: unknown): ValidationResult<CreateCronjobDTO> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { box_id, name, schedule, action, task, enabled, metadata } = body as Record<string, unknown>;

  // box_id validation
  if (!box_id || typeof box_id !== "string") {
    errors.push("box_id is required");
  }

  // name validation
  if (!name || typeof name !== "string") {
    errors.push("name is required");
  } else if (name.trim().length < 1 || name.trim().length > 100) {
    errors.push("name must be 1-100 characters");
  }

  // schedule validation
  if (!schedule || typeof schedule !== "string") {
    errors.push("schedule is required");
  } else if (!CRON_REGEX.test(schedule.trim())) {
    errors.push("Invalid cron schedule format (use standard cron syntax)");
  }

  // action validation
  if (!action || typeof action !== "string") {
    errors.push("action is required");
  } else if (action.trim().length < 1 || action.trim().length > 500) {
    errors.push("action must be 1-500 characters");
  }

  // task validation (optional)
  if (task !== undefined && typeof task !== "string") {
    errors.push("task must be a string");
  }

  // enabled validation (optional)
  if (enabled !== undefined && typeof enabled !== "boolean") {
    errors.push("enabled must be a boolean");
  }

  // metadata validation (optional)
  if (metadata !== undefined && (typeof metadata !== "object" || metadata === null)) {
    errors.push("metadata must be an object");
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      box_id: (box_id as string).trim(),
      name: (name as string).trim(),
      schedule: (schedule as string).trim(),
      action: (action as string).trim(),
      task: task ? (task as string).trim() : undefined,
      enabled: enabled as boolean | undefined,
      metadata: metadata as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Validate update cronjob request
 */
export function validateUpdateCronjob(body: unknown): ValidationResult<UpdateCronjobDTO> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { name, schedule, action, task, enabled, metadata } = body as Record<string, unknown>;

  // name validation (optional)
  if (name !== undefined) {
    if (typeof name !== "string") {
      errors.push("name must be a string");
    } else if (name.trim().length < 1 || name.trim().length > 100) {
      errors.push("name must be 1-100 characters");
    }
  }

  // schedule validation (optional)
  if (schedule !== undefined) {
    if (typeof schedule !== "string") {
      errors.push("schedule must be a string");
    } else if (!CRON_REGEX.test(schedule.trim())) {
      errors.push("Invalid cron schedule format");
    }
  }

  // action validation (optional)
  if (action !== undefined) {
    if (typeof action !== "string") {
      errors.push("action must be a string");
    } else if (action.trim().length < 1 || action.trim().length > 500) {
      errors.push("action must be 1-500 characters");
    }
  }

  // task validation (optional)
  if (task !== undefined && typeof task !== "string") {
    errors.push("task must be a string");
  }

  // enabled validation (optional)
  if (enabled !== undefined && typeof enabled !== "boolean") {
    errors.push("enabled must be a boolean");
  }

  // metadata validation (optional)
  if (metadata !== undefined && (typeof metadata !== "object" || metadata === null)) {
    errors.push("metadata must be an object");
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      name: name ? (name as string).trim() : undefined,
      schedule: schedule ? (schedule as string).trim() : undefined,
      action: action ? (action as string).trim() : undefined,
      task: task ? (task as string).trim() : undefined,
      enabled: enabled as boolean | undefined,
      metadata: metadata as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Validate toggle cronjob request
 */
export function validateToggleCronjob(body: unknown): ValidationResult<ToggleCronjobDTO> {
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { enabled } = body as Record<string, unknown>;

  if (typeof enabled !== "boolean") {
    return { valid: false, errors: ["enabled must be a boolean"], data: null };
  }

  return {
    valid: true,
    errors: [],
    data: { enabled },
  };
}

/**
 * Validate schedule check request
 */
export function validateSchedule(body: unknown): ValidationResult<ValidateScheduleDTO> {
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body required"], data: null };
  }

  const { schedule } = body as Record<string, unknown>;

  if (!schedule || typeof schedule !== "string") {
    return { valid: false, errors: ["schedule is required"], data: null };
  }

  return {
    valid: true,
    errors: [],
    data: { schedule: schedule.trim() },
  };
}
