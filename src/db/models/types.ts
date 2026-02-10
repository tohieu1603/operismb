/**
 * Operis Database Model Types
 */

// ============================================================================
// Customer Types
// ============================================================================
export interface Customer {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  company: string | null;
  plan: CustomerPlan;
  created_at: Date;
  updated_at: Date;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus | null;
  max_boxes: number;
  max_agents_per_box: number;
  metadata: Record<string, unknown>;
}

export type CustomerPlan = "starter" | "professional" | "enterprise";
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface CustomerCreate {
  email: string;
  password_hash: string;
  name: string;
  company?: string;
  plan?: CustomerPlan;
  max_boxes?: number;
  max_agents_per_box?: number;
  metadata?: Record<string, unknown>;
}

export interface CustomerUpdate {
  name?: string;
  company?: string;
  plan?: CustomerPlan;
  stripe_customer_id?: string;
  subscription_status?: SubscriptionStatus;
  max_boxes?: number;
  max_agents_per_box?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Box Types (Mini-PC devices)
// ============================================================================
export interface Box {
  id: string;
  customer_id: string;
  api_key_hash: string;
  hardware_id: string | null;
  name: string;
  hostname: string | null;
  os: BoxOS | null;
  arch: BoxArch | null;
  status: BoxStatus;
  last_seen_at: Date | null;
  last_ip: string | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
}

export type BoxOS = "linux" | "windows" | "darwin";
export type BoxArch = "amd64" | "arm64";
export type BoxStatus = "pending" | "online" | "offline" | "error";

export interface BoxCreate {
  customer_id: string;
  api_key_hash: string;
  name: string;
  hardware_id?: string;
  hostname?: string;
  os?: BoxOS;
  arch?: BoxArch;
  metadata?: Record<string, unknown>;
}

export interface BoxUpdate {
  name?: string;
  hostname?: string;
  os?: BoxOS;
  arch?: BoxArch;
  status?: BoxStatus;
  last_seen_at?: Date;
  last_ip?: string;
  hardware_id?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Box API Key Types
// ============================================================================
export interface BoxApiKey {
  id: string;
  box_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
  revoked_at: Date | null;
}

export interface BoxApiKeyCreate {
  box_id: string;
  key_hash: string;
  key_prefix: string;
  name?: string;
}

// ============================================================================
// Agent Types
// ============================================================================
export interface Agent {
  id: string;
  box_id: string;
  customer_id: string;
  name: string;
  model: string;
  system_prompt: string | null;
  status: AgentStatus;
  last_active_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
}

export type AgentStatus = "active" | "paused" | "error";

export interface AgentCreate {
  box_id: string;
  customer_id: string;
  name: string;
  model: string;
  system_prompt?: string;
  status?: AgentStatus;
  metadata?: Record<string, unknown>;
}

export interface AgentUpdate {
  name?: string;
  model?: string;
  system_prompt?: string;
  status?: AgentStatus;
  last_active_at?: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Cronjob Types (Moltbot-compatible)
// ============================================================================

// Schedule types matching Moltbot gateway
export type CronScheduleType = "cron" | "every" | "at";
export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";
export type CronPayloadKind = "systemEvent" | "agentTurn";
export type CronIsolationPostMode = "summary" | "full";

export interface Cronjob {
  id: string;
  box_id: string;
  customer_id: string;
  agent_id: string; // which agent to use (default: "main")
  name: string;
  description: string | null;
  // Schedule config
  schedule_type: CronScheduleType;
  schedule_expr: string; // cron expression or description
  schedule_tz: string | null; // timezone for cron
  schedule_interval_ms: number | null; // for "every" type
  schedule_at_ms: number | null; // for "at" type (timestamp)
  schedule_anchor_ms: number | null; // anchor for "every" schedule
  // Execution config
  session_target: CronSessionTarget;
  wake_mode: CronWakeMode;
  // Payload config (what to send to gateway)
  payload_kind: CronPayloadKind; // systemEvent or agentTurn
  message: string; // agent message or system event text
  model: string | null;
  thinking: string | null;
  timeout_seconds: number | null;
  allow_unsafe_external_content: boolean;
  deliver: boolean;
  channel: string | null; // "last" or channel ID
  to_recipient: string | null;
  best_effort_deliver: boolean;
  // Isolation config (for isolated sessions)
  isolation_post_to_main_prefix: string | null;
  isolation_post_to_main_mode: CronIsolationPostMode | null;
  isolation_post_to_main_max_chars: number | null;
  // State
  enabled: boolean;
  delete_after_run: boolean;
  running_at: Date | null; // when job started running
  last_run_at: Date | null;
  last_status: "ok" | "error" | "skipped" | null;
  last_error: string | null;
  last_duration_ms: number | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
}

export interface CronjobCreate {
  box_id?: string;
  customer_id: string;
  agent_id?: string;
  name: string;
  description?: string;
  // Schedule
  schedule_type?: CronScheduleType;
  schedule_expr: string;
  schedule_tz?: string;
  schedule_interval_ms?: number;
  schedule_at_ms?: number;
  schedule_anchor_ms?: number;
  // Execution
  session_target?: CronSessionTarget;
  wake_mode?: CronWakeMode;
  // Payload
  payload_kind?: CronPayloadKind;
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
  isolation_post_to_main_mode?: CronIsolationPostMode;
  isolation_post_to_main_max_chars?: number;
  // State
  enabled?: boolean;
  delete_after_run?: boolean;
  next_run_at?: Date;
  metadata?: Record<string, unknown>;
}

export interface CronjobUpdate {
  agent_id?: string;
  name?: string;
  description?: string;
  // Schedule
  schedule_type?: CronScheduleType;
  schedule_expr?: string;
  schedule_tz?: string;
  schedule_interval_ms?: number;
  schedule_at_ms?: number;
  schedule_anchor_ms?: number;
  // Execution
  session_target?: CronSessionTarget;
  wake_mode?: CronWakeMode;
  // Payload
  payload_kind?: CronPayloadKind;
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
  isolation_post_to_main_mode?: CronIsolationPostMode;
  isolation_post_to_main_max_chars?: number;
  // State
  enabled?: boolean;
  delete_after_run?: boolean;
  running_at?: Date | null;
  last_run_at?: Date;
  last_status?: "ok" | "error" | "skipped" | null;
  last_error?: string;
  last_duration_ms?: number;
  next_run_at?: Date | null;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Cronjob Execution Types
// ============================================================================
export interface CronjobExecution {
  id: string;
  cronjob_id: string;
  status: ExecutionStatus;
  started_at: Date;
  finished_at: Date | null;
  duration_ms: number | null;
  output: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

export type ExecutionStatus = "success" | "failure";

export interface CronjobExecutionCreate {
  cronjob_id: string;
  status?: ExecutionStatus | "running";
  started_at?: Date;
  finished_at?: Date;
  duration_ms?: number;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Command Log Types
// ============================================================================
export interface CommandLog {
  id: string;
  box_id: string;
  agent_id: string | null;
  command_id: string;
  command_type: string;
  command_payload: Record<string, unknown> | null;
  success: boolean | null;
  response_payload: Record<string, unknown> | null;
  error: string | null;
  sent_at: Date;
  received_at: Date | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface CommandLogCreate {
  box_id: string;
  agent_id?: string;
  command_id: string;
  command_type: string;
  command_payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CommandLogUpdate {
  success?: boolean;
  response_payload?: Record<string, unknown>;
  error?: string;
  received_at?: Date;
  duration_ms?: number;
}

// ============================================================================
// Session Types
// ============================================================================
export interface Session {
  id: string;
  customer_id: string;
  data: Record<string, unknown>;
  expires_at: Date;
  created_at: Date;
}

export interface SessionCreate {
  id: string;
  customer_id: string;
  data: Record<string, unknown>;
  expires_at: Date;
}

// ============================================================================
// User Types (Operis admin users)
// ============================================================================
export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  last_active_at: Date | null;
  token_balance: number;
  // Custom Moltbot gateway for AI calls
  gateway_url: string | null;
  gateway_token: string | null;
  gateway_hooks_token: string | null; // Separate token for /hooks/* endpoints
  created_at: Date;
  updated_at: Date;
}

export type UserRole = "admin" | "user";

export interface UserCreate {
  email: string;
  password_hash: string;
  name: string;
  role?: UserRole;
  token_balance?: number;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password_hash?: string;
  role?: UserRole;
  is_active?: boolean;
  last_active_at?: Date;
  token_balance?: number;
  gateway_url?: string | null;
  gateway_token?: string | null;
  gateway_hooks_token?: string | null;
}

// ============================================================================
// User API Key Types
// ============================================================================
export interface UserApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserApiKeyCreate {
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name?: string;
  permissions?: string[];
  expires_at?: Date;
}

export interface UserApiKeyUpdate {
  name?: string;
  permissions?: string[];
  is_active?: boolean;
  last_used_at?: Date;
  expires_at?: Date;
}

// ============================================================================
// Refresh Token Types
// ============================================================================
export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  family: string;
  is_revoked: boolean;
  revoked_at: Date | null;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: Date;
  created_at: Date;
}

export interface RefreshTokenCreate {
  user_id: string;
  token_hash: string;
  family: string;
  expires_at: Date;
  user_agent?: string;
  ip_address?: string;
}

// ============================================================================
// Token Transaction Types
// ============================================================================
export interface TokenTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  description: string | null;
  reference_id: string | null;
  created_at: Date;
}

export type TransactionType = "credit" | "debit" | "adjustment";

export interface TokenTransactionCreate {
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  description?: string;
  reference_id?: string;
}

// ============================================================================
// Token Usage Analytics Types
// ============================================================================
export interface TokenUsage {
  id: string;
  user_id: string;
  request_type: RequestType;
  request_id: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_tokens: number;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export type RequestType = "chat" | "cronjob" | "api";

export interface TokenUsageCreate {
  user_id: string;
  request_type: RequestType;
  request_id?: string;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
  cost_tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface TokenUsageStats {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_tokens: number;
}

export interface TokenUsageByType extends TokenUsageStats {
  request_type: RequestType;
}

export interface TokenUsageByDate extends TokenUsageStats {
  date: string;
}

export interface TokenUsageByUser extends TokenUsageStats {
  user_id: string;
  user_email: string;
  user_name: string;
}
