/**
 * Cron validators (Moltbot-compatible)
 */

import type { ValidationResult } from "./common.validator.js";

// Cron schedule regex (basic validation - 5 or 6 fields)
const CRON_REGEX = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)(\s+(\*|[0-9,\-\/]+))?$/;

// Valid schedule types
const SCHEDULE_TYPES = ["cron", "every", "at"] as const;
const SESSION_TARGETS = ["main", "isolated"] as const;
const WAKE_MODES = ["next-heartbeat", "now"] as const;
const PAYLOAD_KINDS = ["systemEvent", "agentTurn"] as const;
const ISOLATION_POST_MODES = ["summary", "full"] as const;

export interface CreateCronjobDTO {
  box_id?: string;
  agent_id?: string;
  name: string;
  description?: string;
  // Schedule
  schedule_type?: "cron" | "every" | "at";
  schedule_expr: string;
  schedule_tz?: string;
  schedule_interval_ms?: number;
  schedule_at_ms?: number;
  schedule_anchor_ms?: number;
  // Execution
  session_target?: "main" | "isolated";
  wake_mode?: "next-heartbeat" | "now";
  // Payload
  payload_kind?: "systemEvent" | "agentTurn";
  message: string;
  model?: string;
  thinking?: string;
  timeout_seconds?: number;
  allow_unsafe_external_content?: boolean;
  deliver?: boolean;
  channel?: string;
  to_recipient?: string;
  best_effort_deliver?: boolean;
  // Isolation config
  isolation_post_to_main_prefix?: string;
  isolation_post_to_main_mode?: "summary" | "full";
  isolation_post_to_main_max_chars?: number;
  // State
  enabled?: boolean;
  delete_after_run?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateCronjobDTO {
  agent_id?: string;
  name?: string;
  description?: string;
  // Schedule
  schedule_type?: "cron" | "every" | "at";
  schedule_expr?: string;
  schedule_tz?: string;
  schedule_interval_ms?: number;
  schedule_at_ms?: number;
  schedule_anchor_ms?: number;
  // Execution
  session_target?: "main" | "isolated";
  wake_mode?: "next-heartbeat" | "now";
  // Payload
  payload_kind?: "systemEvent" | "agentTurn";
  message?: string;
  model?: string;
  thinking?: string;
  timeout_seconds?: number;
  allow_unsafe_external_content?: boolean;
  deliver?: boolean;
  channel?: string;
  to_recipient?: string;
  best_effort_deliver?: boolean;
  // Isolation config
  isolation_post_to_main_prefix?: string;
  isolation_post_to_main_mode?: "summary" | "full";
  isolation_post_to_main_max_chars?: number;
  // State
  enabled?: boolean;
  delete_after_run?: boolean;
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
  } = body as Record<string, unknown>;

  // box_id validation (optional)
  if (box_id !== undefined && typeof box_id !== "string") {
    errors.push("box_id must be a string");
  }

  // name validation
  if (!name || typeof name !== "string") {
    errors.push("name is required");
  } else if (name.trim().length < 1 || name.trim().length > 100) {
    errors.push("name must be 1-100 characters");
  }

  // description validation (optional)
  if (description !== undefined && typeof description !== "string") {
    errors.push("description must be a string");
  }

  // schedule_type validation
  const scheduleTypeValue = (schedule_type as string) || "cron";
  if (!SCHEDULE_TYPES.includes(scheduleTypeValue as typeof SCHEDULE_TYPES[number])) {
    errors.push("schedule_type must be one of: cron, every, at");
  }

  // schedule_expr validation
  if (!schedule_expr || typeof schedule_expr !== "string") {
    errors.push("schedule_expr is required");
  } else if (scheduleTypeValue === "cron" && !CRON_REGEX.test(schedule_expr.trim())) {
    errors.push("Invalid cron schedule format (use standard cron syntax)");
  }

  // schedule_tz validation (optional)
  if (schedule_tz !== undefined && typeof schedule_tz !== "string") {
    errors.push("schedule_tz must be a string");
  }

  // schedule_interval_ms validation (required for "every" type)
  if (scheduleTypeValue === "every") {
    if (schedule_interval_ms === undefined || typeof schedule_interval_ms !== "number") {
      errors.push("schedule_interval_ms is required for 'every' schedule type");
    } else if (schedule_interval_ms < 1000) {
      errors.push("schedule_interval_ms must be at least 1000 (1 second)");
    }
  }

  // schedule_at_ms validation (required for "at" type)
  if (scheduleTypeValue === "at") {
    if (schedule_at_ms === undefined || typeof schedule_at_ms !== "number") {
      errors.push("schedule_at_ms is required for 'at' schedule type");
    } else if (schedule_at_ms < Date.now()) {
      errors.push("schedule_at_ms must be in the future");
    }
  }

  // schedule_anchor_ms validation (optional, for "every" type)
  if (schedule_anchor_ms !== undefined && typeof schedule_anchor_ms !== "number") {
    errors.push("schedule_anchor_ms must be a number");
  }

  // agent_id validation (optional)
  if (agent_id !== undefined && typeof agent_id !== "string") {
    errors.push("agent_id must be a string");
  }

  // session_target validation
  if (session_target !== undefined && !SESSION_TARGETS.includes(session_target as typeof SESSION_TARGETS[number])) {
    errors.push("session_target must be one of: main, isolated");
  }

  // wake_mode validation
  if (wake_mode !== undefined && !WAKE_MODES.includes(wake_mode as typeof WAKE_MODES[number])) {
    errors.push("wake_mode must be one of: next-heartbeat, now");
  }

  // payload_kind validation
  const payloadKindValue = (payload_kind as string) || "agentTurn";
  if (!PAYLOAD_KINDS.includes(payloadKindValue as typeof PAYLOAD_KINDS[number])) {
    errors.push("payload_kind must be one of: systemEvent, agentTurn");
  }

  // session_target ↔ payload_kind constraint (Moltbot requirement)
  const sessionTargetValue = (session_target as string) || "main";
  if (sessionTargetValue === "main" && payloadKindValue !== "systemEvent") {
    errors.push('session_target="main" requires payload_kind="systemEvent"');
  }
  if (sessionTargetValue === "isolated" && payloadKindValue !== "agentTurn") {
    errors.push('session_target="isolated" requires payload_kind="agentTurn"');
  }

  // message validation (required - serves as text for systemEvent or message for agentTurn)
  if (!message || typeof message !== "string") {
    errors.push("message is required");
  } else if (message.trim().length < 1 || message.trim().length > 10000) {
    errors.push("message must be 1-10000 characters");
  }

  // model validation (optional)
  if (model !== undefined && typeof model !== "string") {
    errors.push("model must be a string");
  }

  // thinking validation (optional)
  if (thinking !== undefined && typeof thinking !== "string") {
    errors.push("thinking must be a string");
  }

  // timeout_seconds validation (optional)
  if (timeout_seconds !== undefined) {
    if (typeof timeout_seconds !== "number") {
      errors.push("timeout_seconds must be a number");
    } else if (timeout_seconds < 1 || timeout_seconds > 600) {
      errors.push("timeout_seconds must be 1-600");
    }
  }

  // deliver validation (optional)
  if (deliver !== undefined && typeof deliver !== "boolean") {
    errors.push("deliver must be a boolean");
  }

  // channel validation (optional)
  if (channel !== undefined && typeof channel !== "string") {
    errors.push("channel must be a string");
  }

  // to_recipient validation (optional)
  if (to_recipient !== undefined && typeof to_recipient !== "string") {
    errors.push("to_recipient must be a string");
  }

  // allow_unsafe_external_content validation (optional)
  if (allow_unsafe_external_content !== undefined && typeof allow_unsafe_external_content !== "boolean") {
    errors.push("allow_unsafe_external_content must be a boolean");
  }

  // best_effort_deliver validation (optional)
  if (best_effort_deliver !== undefined && typeof best_effort_deliver !== "boolean") {
    errors.push("best_effort_deliver must be a boolean");
  }

  // isolation_post_to_main_prefix validation (optional)
  if (isolation_post_to_main_prefix !== undefined && typeof isolation_post_to_main_prefix !== "string") {
    errors.push("isolation_post_to_main_prefix must be a string");
  }

  // isolation_post_to_main_mode validation (optional)
  if (isolation_post_to_main_mode !== undefined && !ISOLATION_POST_MODES.includes(isolation_post_to_main_mode as typeof ISOLATION_POST_MODES[number])) {
    errors.push("isolation_post_to_main_mode must be one of: summary, full");
  }

  // isolation_post_to_main_max_chars validation (optional)
  if (isolation_post_to_main_max_chars !== undefined) {
    if (typeof isolation_post_to_main_max_chars !== "number") {
      errors.push("isolation_post_to_main_max_chars must be a number");
    } else if (isolation_post_to_main_max_chars < 100 || isolation_post_to_main_max_chars > 100000) {
      errors.push("isolation_post_to_main_max_chars must be 100-100000");
    }
  }

  // enabled validation (optional)
  if (enabled !== undefined && typeof enabled !== "boolean") {
    errors.push("enabled must be a boolean");
  }

  // delete_after_run validation (optional)
  if (delete_after_run !== undefined && typeof delete_after_run !== "boolean") {
    errors.push("delete_after_run must be a boolean");
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
      box_id: box_id ? (box_id as string).trim() : undefined,
      agent_id: agent_id ? (agent_id as string).trim() : undefined,
      name: (name as string).trim(),
      description: description ? (description as string).trim() : undefined,
      schedule_type: scheduleTypeValue as "cron" | "every" | "at",
      schedule_expr: (schedule_expr as string).trim(),
      schedule_tz: schedule_tz ? (schedule_tz as string).trim() : undefined,
      schedule_interval_ms: schedule_interval_ms as number | undefined,
      schedule_at_ms: schedule_at_ms as number | undefined,
      schedule_anchor_ms: schedule_anchor_ms as number | undefined,
      session_target: (session_target as "main" | "isolated") ?? "main",
      wake_mode: (wake_mode as "next-heartbeat" | "now") ?? "next-heartbeat",
      payload_kind: (payload_kind as "systemEvent" | "agentTurn") ?? "agentTurn",
      message: (message as string).trim(),
      model: model ? (model as string).trim() : undefined,
      thinking: thinking ? (thinking as string).trim() : undefined,
      timeout_seconds: timeout_seconds as number | undefined,
      allow_unsafe_external_content: (allow_unsafe_external_content as boolean) ?? false,
      deliver: (deliver as boolean) ?? true,
      channel: channel ? (channel as string).trim() : undefined,
      to_recipient: to_recipient ? (to_recipient as string).trim() : undefined,
      best_effort_deliver: (best_effort_deliver as boolean) ?? false,
      isolation_post_to_main_prefix: isolation_post_to_main_prefix ? (isolation_post_to_main_prefix as string).trim() : undefined,
      isolation_post_to_main_mode: isolation_post_to_main_mode as "summary" | "full" | undefined,
      isolation_post_to_main_max_chars: isolation_post_to_main_max_chars as number | undefined,
      enabled: (enabled as boolean) ?? true,
      delete_after_run: (delete_after_run as boolean) ?? false,
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
  } = body as Record<string, unknown>;

  // agent_id validation (optional)
  if (agent_id !== undefined && typeof agent_id !== "string") {
    errors.push("agent_id must be a string");
  }

  // name validation (optional)
  if (name !== undefined) {
    if (typeof name !== "string") {
      errors.push("name must be a string");
    } else if (name.trim().length < 1 || name.trim().length > 100) {
      errors.push("name must be 1-100 characters");
    }
  }

  // description validation (optional)
  if (description !== undefined && typeof description !== "string") {
    errors.push("description must be a string");
  }

  // schedule_type validation (optional)
  if (schedule_type !== undefined && !SCHEDULE_TYPES.includes(schedule_type as typeof SCHEDULE_TYPES[number])) {
    errors.push("schedule_type must be one of: cron, every, at");
  }

  // schedule_expr validation (optional)
  if (schedule_expr !== undefined) {
    if (typeof schedule_expr !== "string") {
      errors.push("schedule_expr must be a string");
    } else if (schedule_type === "cron" && !CRON_REGEX.test(schedule_expr.trim())) {
      errors.push("Invalid cron schedule format");
    }
  }

  // schedule_tz validation (optional)
  if (schedule_tz !== undefined && typeof schedule_tz !== "string") {
    errors.push("schedule_tz must be a string");
  }

  // schedule_interval_ms validation (optional)
  if (schedule_interval_ms !== undefined) {
    if (typeof schedule_interval_ms !== "number") {
      errors.push("schedule_interval_ms must be a number");
    } else if (schedule_interval_ms < 1000) {
      errors.push("schedule_interval_ms must be at least 1000 (1 second)");
    }
  }

  // schedule_at_ms validation (optional)
  if (schedule_at_ms !== undefined) {
    if (typeof schedule_at_ms !== "number") {
      errors.push("schedule_at_ms must be a number");
    }
  }

  // schedule_anchor_ms validation (optional)
  if (schedule_anchor_ms !== undefined && typeof schedule_anchor_ms !== "number") {
    errors.push("schedule_anchor_ms must be a number");
  }

  // session_target validation (optional)
  if (session_target !== undefined && !SESSION_TARGETS.includes(session_target as typeof SESSION_TARGETS[number])) {
    errors.push("session_target must be one of: main, isolated");
  }

  // wake_mode validation (optional)
  if (wake_mode !== undefined && !WAKE_MODES.includes(wake_mode as typeof WAKE_MODES[number])) {
    errors.push("wake_mode must be one of: next-heartbeat, now");
  }

  // payload_kind validation (optional)
  if (payload_kind !== undefined && !PAYLOAD_KINDS.includes(payload_kind as typeof PAYLOAD_KINDS[number])) {
    errors.push("payload_kind must be one of: systemEvent, agentTurn");
  }

  // message validation (optional)
  if (message !== undefined) {
    if (typeof message !== "string") {
      errors.push("message must be a string");
    } else if (message.trim().length < 1 || message.trim().length > 10000) {
      errors.push("message must be 1-10000 characters");
    }
  }

  // model validation (optional)
  if (model !== undefined && typeof model !== "string") {
    errors.push("model must be a string");
  }

  // thinking validation (optional)
  if (thinking !== undefined && typeof thinking !== "string") {
    errors.push("thinking must be a string");
  }

  // timeout_seconds validation (optional)
  if (timeout_seconds !== undefined) {
    if (typeof timeout_seconds !== "number") {
      errors.push("timeout_seconds must be a number");
    } else if (timeout_seconds < 1 || timeout_seconds > 600) {
      errors.push("timeout_seconds must be 1-600");
    }
  }

  // allow_unsafe_external_content validation (optional)
  if (allow_unsafe_external_content !== undefined && typeof allow_unsafe_external_content !== "boolean") {
    errors.push("allow_unsafe_external_content must be a boolean");
  }

  // deliver validation (optional)
  if (deliver !== undefined && typeof deliver !== "boolean") {
    errors.push("deliver must be a boolean");
  }

  // channel validation (optional)
  if (channel !== undefined && typeof channel !== "string") {
    errors.push("channel must be a string");
  }

  // to_recipient validation (optional)
  if (to_recipient !== undefined && typeof to_recipient !== "string") {
    errors.push("to_recipient must be a string");
  }

  // best_effort_deliver validation (optional)
  if (best_effort_deliver !== undefined && typeof best_effort_deliver !== "boolean") {
    errors.push("best_effort_deliver must be a boolean");
  }

  // isolation_post_to_main_prefix validation (optional)
  if (isolation_post_to_main_prefix !== undefined && typeof isolation_post_to_main_prefix !== "string") {
    errors.push("isolation_post_to_main_prefix must be a string");
  }

  // isolation_post_to_main_mode validation (optional)
  if (isolation_post_to_main_mode !== undefined && !ISOLATION_POST_MODES.includes(isolation_post_to_main_mode as typeof ISOLATION_POST_MODES[number])) {
    errors.push("isolation_post_to_main_mode must be one of: summary, full");
  }

  // isolation_post_to_main_max_chars validation (optional)
  if (isolation_post_to_main_max_chars !== undefined) {
    if (typeof isolation_post_to_main_max_chars !== "number") {
      errors.push("isolation_post_to_main_max_chars must be a number");
    } else if (isolation_post_to_main_max_chars < 100 || isolation_post_to_main_max_chars > 100000) {
      errors.push("isolation_post_to_main_max_chars must be 100-100000");
    }
  }

  // enabled validation (optional)
  if (enabled !== undefined && typeof enabled !== "boolean") {
    errors.push("enabled must be a boolean");
  }

  // delete_after_run validation (optional)
  if (delete_after_run !== undefined && typeof delete_after_run !== "boolean") {
    errors.push("delete_after_run must be a boolean");
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
      agent_id: agent_id ? (agent_id as string).trim() : undefined,
      name: name ? (name as string).trim() : undefined,
      description: description ? (description as string).trim() : undefined,
      schedule_type: schedule_type as "cron" | "every" | "at" | undefined,
      schedule_expr: schedule_expr ? (schedule_expr as string).trim() : undefined,
      schedule_tz: schedule_tz ? (schedule_tz as string).trim() : undefined,
      schedule_interval_ms: schedule_interval_ms as number | undefined,
      schedule_at_ms: schedule_at_ms as number | undefined,
      schedule_anchor_ms: schedule_anchor_ms as number | undefined,
      session_target: session_target as "main" | "isolated" | undefined,
      wake_mode: wake_mode as "next-heartbeat" | "now" | undefined,
      payload_kind: payload_kind as "systemEvent" | "agentTurn" | undefined,
      message: message ? (message as string).trim() : undefined,
      model: model ? (model as string).trim() : undefined,
      thinking: thinking ? (thinking as string).trim() : undefined,
      timeout_seconds: timeout_seconds as number | undefined,
      allow_unsafe_external_content: allow_unsafe_external_content as boolean | undefined,
      deliver: deliver as boolean | undefined,
      channel: channel ? (channel as string).trim() : undefined,
      to_recipient: to_recipient ? (to_recipient as string).trim() : undefined,
      best_effort_deliver: best_effort_deliver as boolean | undefined,
      isolation_post_to_main_prefix: isolation_post_to_main_prefix ? (isolation_post_to_main_prefix as string).trim() : undefined,
      isolation_post_to_main_mode: isolation_post_to_main_mode as "summary" | "full" | undefined,
      isolation_post_to_main_max_chars: isolation_post_to_main_max_chars as number | undefined,
      enabled: enabled as boolean | undefined,
      delete_after_run: delete_after_run as boolean | undefined,
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
