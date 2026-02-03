/**
 * Customer Repository
 * CRUD operations for customers table
 */

import { query, queryOne, queryAll } from "../connection.js";
import type { Customer, CustomerCreate, CustomerUpdate } from "./types.js";

/**
 * Create a new customer
 */
export async function createCustomer(data: CustomerCreate): Promise<Customer> {
  const result = await queryOne<Customer>(
    `INSERT INTO customers (
      email, password_hash, name, company, plan,
      max_boxes, max_agents_per_box, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.email,
      data.password_hash,
      data.name,
      data.company ?? null,
      data.plan ?? "starter",
      data.max_boxes ?? 1,
      data.max_agents_per_box ?? 5,
      JSON.stringify(data.metadata ?? {}),
    ],
  );

  if (!result) {
    throw new Error("Failed to create customer");
  }

  return result;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  return queryOne<Customer>("SELECT * FROM customers WHERE id = $1", [id]);
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  return queryOne<Customer>("SELECT * FROM customers WHERE email = $1", [email.toLowerCase()]);
}

/**
 * Get customer by Stripe customer ID
 */
export async function getCustomerByStripeId(stripeId: string): Promise<Customer | null> {
  return queryOne<Customer>("SELECT * FROM customers WHERE stripe_customer_id = $1", [stripeId]);
}

/**
 * Update customer
 */
export async function updateCustomer(id: string, data: CustomerUpdate): Promise<Customer | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.company !== undefined) {
    fields.push(`company = $${paramIndex++}`);
    values.push(data.company);
  }
  if (data.plan !== undefined) {
    fields.push(`plan = $${paramIndex++}`);
    values.push(data.plan);
  }
  if (data.stripe_customer_id !== undefined) {
    fields.push(`stripe_customer_id = $${paramIndex++}`);
    values.push(data.stripe_customer_id);
  }
  if (data.subscription_status !== undefined) {
    fields.push(`subscription_status = $${paramIndex++}`);
    values.push(data.subscription_status);
  }
  if (data.max_boxes !== undefined) {
    fields.push(`max_boxes = $${paramIndex++}`);
    values.push(data.max_boxes);
  }
  if (data.max_agents_per_box !== undefined) {
    fields.push(`max_agents_per_box = $${paramIndex++}`);
    values.push(data.max_agents_per_box);
  }
  if (data.metadata !== undefined) {
    fields.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(data.metadata));
  }

  if (fields.length === 0) {
    return getCustomerById(id);
  }

  values.push(id);

  return queryOne<Customer>(
    `UPDATE customers SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}

/**
 * Delete customer
 */
export async function deleteCustomer(id: string): Promise<boolean> {
  const result = await query("DELETE FROM customers WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
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

  let whereClause = "";
  const params: unknown[] = [];

  if (options.plan) {
    whereClause = "WHERE plan = $1";
    params.push(options.plan);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM customers ${whereClause}`,
    params,
  );

  const customers = await queryAll<Customer>(
    `SELECT * FROM customers ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return {
    customers,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

/**
 * Check if customer can add more boxes
 */
export async function canAddBox(customerId: string): Promise<boolean> {
  const result = await queryOne<{ can_add: boolean }>(
    `SELECT (
      SELECT COUNT(*) FROM boxes WHERE customer_id = $1
    ) < (
      SELECT max_boxes FROM customers WHERE id = $1
    ) as can_add`,
    [customerId],
  );
  return result?.can_add ?? false;
}

/**
 * Check if customer can add more agents to a box
 */
export async function canAddAgent(customerId: string, boxId: string): Promise<boolean> {
  const result = await queryOne<{ can_add: boolean }>(
    `SELECT (
      SELECT COUNT(*) FROM agents WHERE box_id = $1
    ) < (
      SELECT max_agents_per_box FROM customers WHERE id = $2
    ) as can_add`,
    [boxId, customerId],
  );
  return result?.can_add ?? false;
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
