/**
 * Customer Repository
 * CRUD operations for customers table
 */

import { AppDataSource } from "../data-source";
import { CustomerEntity } from "../entities/customer.entity";
import { BoxEntity } from "../entities/box.entity";
import { AgentEntity } from "../entities/agent.entity";
import type { Customer, CustomerCreate, CustomerUpdate } from "./types";

function getRepo() {
  return AppDataSource.getRepository(CustomerEntity);
}

function getBoxRepo() {
  return AppDataSource.getRepository(BoxEntity);
}

function getAgentRepo() {
  return AppDataSource.getRepository(AgentEntity);
}

/**
 * Create a new customer
 */
export async function createCustomer(data: CustomerCreate): Promise<Customer> {
  const customer = getRepo().create({
    email: data.email,
    password_hash: data.password_hash,
    name: data.name,
    company: data.company ?? null,
    plan: data.plan ?? "starter",
    max_boxes: data.max_boxes ?? 1,
    max_agents_per_box: data.max_agents_per_box ?? 5,
    metadata: data.metadata ?? {},
  });

  const result = await getRepo().save(customer);
  return result as unknown as Customer;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const result = await getRepo().findOneBy({ id });
  return result as unknown as Customer | null;
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const result = await getRepo().findOneBy({ email: email.toLowerCase() });
  return result as unknown as Customer | null;
}

/**
 * Get customer by Stripe customer ID
 */
export async function getCustomerByStripeId(stripeId: string): Promise<Customer | null> {
  const result = await getRepo().findOneBy({ stripe_customer_id: stripeId });
  return result as unknown as Customer | null;
}

/**
 * Update customer
 */
export async function updateCustomer(id: string, data: CustomerUpdate): Promise<Customer | null> {
  const updateData: Record<string, any> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.plan !== undefined) updateData.plan = data.plan;
  if (data.stripe_customer_id !== undefined) updateData.stripe_customer_id = data.stripe_customer_id;
  if (data.subscription_status !== undefined) updateData.subscription_status = data.subscription_status;
  if (data.max_boxes !== undefined) updateData.max_boxes = data.max_boxes;
  if (data.max_agents_per_box !== undefined) updateData.max_agents_per_box = data.max_agents_per_box;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  if (Object.keys(updateData).length === 0) {
    return getCustomerById(id);
  }

  await getRepo().update({ id }, updateData);
  const result = await getRepo().findOneBy({ id });
  return result as unknown as Customer | null;
}

/**
 * Delete customer
 */
export async function deleteCustomer(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * List all customers (with pagination)
 */
export async function listCustomers(options: {
  limit?: number;
  offset?: number;
  plan?: string;
}): Promise<{ customers: Customer[]; total: number }> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const where = options.plan ? { plan: options.plan } : {};

  const [customers, total] = await getRepo().findAndCount({
    where,
    order: { created_at: "DESC" },
    take: limit,
    skip: offset,
  });

  return {
    customers: customers as unknown as Customer[],
    total,
  };
}

/**
 * Check if customer can add more boxes
 */
export async function canAddBox(customerId: string): Promise<boolean> {
  const customer = await getRepo().findOneBy({ id: customerId });
  if (!customer) return false;

  const boxCount = await getBoxRepo().countBy({ customer_id: customerId });
  return boxCount < customer.max_boxes;
}

/**
 * Check if customer can add more agents to a box
 */
export async function canAddAgent(customerId: string, boxId: string): Promise<boolean> {
  const customer = await getRepo().findOneBy({ id: customerId });
  if (!customer) return false;

  const agentCount = await getAgentRepo().countBy({ box_id: boxId });
  return agentCount < customer.max_agents_per_box;
}

export default {
  createCustomer,
  getCustomerById,
  getCustomerByEmail,
  getCustomerByStripeId,
  updateCustomer,
  deleteCustomer,
  listCustomers,
  canAddBox,
  canAddAgent,
};
