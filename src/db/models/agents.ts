/**
 * Agent Repository
 * CRUD operations for agents table
 */

import { AppDataSource } from "../data-source.js";
import { AgentEntity } from "../entities/agent.entity.js";
import type { Agent, AgentCreate, AgentUpdate } from "./types.js";

function getRepo() {
  return AppDataSource.getRepository(AgentEntity);
}

/**
 * Create a new agent
 */
export async function createAgent(data: AgentCreate): Promise<Agent> {
  const entity = getRepo().create({
    box_id: data.box_id,
    customer_id: data.customer_id,
    name: data.name,
    model: data.model,
    system_prompt: data.system_prompt ?? null,
    status: data.status ?? "active",
    metadata: data.metadata ?? {},
  });

  const result = await getRepo().save(entity);
  return result as unknown as Agent;
}

/**
 * Get agent by ID
 */
export async function getAgentById(id: string): Promise<Agent | null> {
  const result = await getRepo().findOneBy({ id });
  return result as unknown as Agent | null;
}

/**
 * Update agent
 */
export async function updateAgent(id: string, data: AgentUpdate): Promise<Agent | null> {
  const updateData: Record<string, any> = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.model !== undefined) {
    updateData.model = data.model;
  }
  if (data.system_prompt !== undefined) {
    updateData.system_prompt = data.system_prompt;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.last_active_at !== undefined) {
    updateData.last_active_at = data.last_active_at;
  }
  if (data.metadata !== undefined) {
    updateData.metadata = data.metadata;
  }

  if (Object.keys(updateData).length === 0) {
    return getAgentById(id);
  }

  await getRepo().update({ id }, updateData);
  const result = await getRepo().findOneBy({ id });
  return result as unknown as Agent | null;
}

/**
 * Delete agent
 */
export async function deleteAgent(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
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

  const whereConditions: Record<string, any> = { box_id: boxId };

  if (options?.status) {
    whereConditions.status = options.status;
  }

  const [agents, total] = await getRepo().findAndCount({
    where: whereConditions,
    order: { created_at: "DESC" },
    take: limit,
    skip: offset,
  });

  return {
    agents: agents as unknown as Agent[],
    total,
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

  const whereConditions: Record<string, any> = { customer_id: customerId };

  if (options?.boxId) {
    whereConditions.box_id = options.boxId;
  }
  if (options?.status) {
    whereConditions.status = options.status;
  }

  const [agents, total] = await getRepo().findAndCount({
    where: whereConditions,
    order: { created_at: "DESC" },
    take: limit,
    skip: offset,
  });

  return {
    agents: agents as unknown as Agent[],
    total,
  };
}

/**
 * Count active agents for a box
 * (Used for limit checking)
 */
export async function countActiveAgentsForBox(boxId: string): Promise<number> {
  return await getRepo().count({
    where: { box_id: boxId, status: "active" },
  });
}

/**
 * Update agent's last active timestamp
 */
export async function touchAgent(id: string): Promise<void> {
  await getRepo().update({ id }, { last_active_at: new Date() });
}

/**
 * Pause all agents for a box
 */
export async function pauseAllAgentsForBox(boxId: string): Promise<number> {
  const result = await getRepo()
    .createQueryBuilder()
    .update()
    .set({ status: "paused" })
    .where("box_id = :boxId AND status = 'active'", { boxId })
    .returning("id")
    .execute();

  return result.affected ?? 0;
}

/**
 * Resume all agents for a box
 */
export async function resumeAllAgentsForBox(boxId: string): Promise<number> {
  const result = await getRepo()
    .createQueryBuilder()
    .update()
    .set({ status: "active" })
    .where("box_id = :boxId AND status = 'paused'", { boxId })
    .returning("id")
    .execute();

  return result.affected ?? 0;
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
