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
// Cronjob Types
// ============================================================================
export interface Cronjob {
  id: string;
  box_id: string;
  customer_id: string;
  name: string;
  schedule: string;
  action: string;
  task: string | null;
  enabled: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
}

export interface CronjobCreate {
  box_id: string;
  customer_id: string;
  name: string;
  schedule: string;
  action: string;
  task?: string;
  enabled?: boolean;
  next_run_at?: Date;
  metadata?: Record<string, unknown>;
}

export interface CronjobUpdate {
  name?: string;
  schedule?: string;
  action?: string;
  task?: string;
  enabled?: boolean;
  last_run_at?: Date;
  next_run_at?: Date;
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
