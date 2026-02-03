/**
 * Agent Repository
 * CRUD operations for agents table
 */

import { queryOne, queryAll } from "../connection.js";
import type { Agent, AgentCreate, AgentUpdate } from "./types.js";

/**
 * Create a new agent
 */
export async function createAgent(data: AgentCreate): Promise<Agent> {
  const result = await queryOne<Agent>(
    `INSERT INTO agents (
      box_id, customer_id, name, model, system_prompt, status, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.box_id,
      data.customer_id,
      data.name,
      data.model,
      data.system_prompt ?? null,
      data.status ?? "active",
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  if (!result) {
    throw new Error("Failed to create agent");
  }

  return result;
}

/**
 * Get agent by ID
 */
export async function getAgentById(id: string): Promise<Agent | null> {
  return queryOne<Agent>("SELECT * FROM agents WHERE id = $1", [id]);
}

/**
 * Update agent
 */
export async function updateAgent(id: string, data: AgentUpdate): Promise<Agent | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.model !== undefined) {
    fields.push(`model = $${paramIndex++}`);
    values.push(data.model);
  }
  if (data.system_prompt !== undefined) {
    fields.push(`system_prompt = $${paramIndex++}`);
    values.push(data.system_prompt);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.last_active_at !== undefined) {
    fields.push(`last_active_at = $${paramIndex++}`);
    values.push(data.last_active_at);
  }
  if (data.metadata !== undefined) {
    fields.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(data.metadata));
  }

  if (fields.length === 0) {
    return getAgentById(id);
  }

  values.push(id);

  return queryOne<Agent>(
    `UPDATE agents SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}

/**
 * Delete agent
 */
export async function deleteAgent(id: string): Promise<boolean> {
  const result = await queryOne<{ id: string }>("DELETE FROM agents WHERE id = $1 RETURNING id", [
    id,
  ]);
  return result !== null;
}

/**
 * List agents for a box
 */
export async function listAgentsByBox(
  boxId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ agents: Agent[]; total: number }> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const params: unknown[] = [boxId];

  let whereClause = "WHERE box_id = $1";

  if (options?.status) {
    whereClause += ` AND status = $${params.length + 1}`;
    params.push(options.status);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM agents ${whereClause}`,
    params,
  );

  const agents = await queryAll<Agent>(
    `SELECT * FROM agents ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    agents,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * List agents for a customer
 */
export async function listAgentsByCustomer(
  customerId: string,
  options?: {
    boxId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ agents: Agent[]; total: number }> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const params: unknown[] = [customerId];

  let whereClause = "WHERE customer_id = $1";

  if (options?.boxId) {
    whereClause += ` AND box_id = $${params.length + 1}`;
    params.push(options.boxId);
  }
  if (options?.status) {
    whereClause += ` AND status = $${params.length + 1}`;
    params.push(options.status);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM agents ${whereClause}`,
    params,
  );

  const agents = await queryAll<Agent>(
    `SELECT * FROM agents ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    agents,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * Count active agents for a box
 * (Used for limit checking)
 */
export async function countActiveAgentsForBox(boxId: string): Promise<number> {
  const result = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM agents WHERE box_id = $1 AND status = 'active'",
    [boxId],
  );
  return parseInt(result?.count ?? "0", 10);
}

/**
 * Update agent's last active timestamp
 */
export async function touchAgent(id: string): Promise<void> {
  await queryOne("UPDATE agents SET last_active_at = NOW() WHERE id = $1", [id]);
}

/**
 * Pause all agents for a box
 */
export async function pauseAllAgentsForBox(boxId: string): Promise<number> {
  const result = await queryAll<{ id: string }>(
    "UPDATE agents SET status = 'paused' WHERE box_id = $1 AND status = 'active' RETURNING id",
    [boxId],
  );
  return result.length;
}

/**
 * Resume all agents for a box
 */
export async function resumeAllAgentsForBox(boxId: string): Promise<number> {
  const result = await queryAll<{ id: string }>(
    "UPDATE agents SET status = 'active' WHERE box_id = $1 AND status = 'paused' RETURNING id",
    [boxId],
  );
  return result.length;
}

export default {
  createAgent,
  getAgentById,
  updateAgent,
  deleteAgent,
  listAgentsByBox,
  listAgentsByCustomer,
  countActiveAgentsForBox,
  touchAgent,
  pauseAllAgentsForBox,
  resumeAllAgentsForBox,
};
