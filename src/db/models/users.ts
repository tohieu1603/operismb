/**
 * User Repository
 * CRUD operations for users table (Operis admin users)
 */

import { AppDataSource } from "../data-source.js";
import { UserEntity } from "../entities/user.entity.js";
import type { User, UserCreate, UserUpdate } from "./types.js";

function getRepo() {
  return AppDataSource.getRepository(UserEntity);
}

/**
 * Create a new user
 */
export async function createUser(data: UserCreate): Promise<User> {
  const user = getRepo().create({
    email: data.email.toLowerCase(),
    password_hash: data.password_hash,
    name: data.name,
    role: data.role ?? "user",
    token_balance: data.token_balance ?? 1000000,
    is_active: data.is_active,
    unique_machine: data.unique_machine,
    gateway_url: data.gateway_url,
    gateway_token: data.gateway_token,
    gateway_hooks_token: data.gateway_hooks_token,
    auth_profiles_path: data.auth_profiles_path,
  });

  const result = await getRepo().save(user);
  return result as unknown as User;
}

/**
 * Get user by unique_machine
 */
export async function getUserByMachine(machine: string): Promise<User | null> {
  const result = await getRepo().findOneBy({ unique_machine: machine });
  return result as unknown as User | null;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await getRepo().findOneBy({ id });
  return result as unknown as User | null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await getRepo().findOneBy({ email: email.toLowerCase() });
  return result as unknown as User | null;
}

/**
 * Update user
 */
export async function updateUser(id: string, data: UserUpdate): Promise<User | null> {
  const updateData: Partial<UserEntity> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.password_hash !== undefined) updateData.password_hash = data.password_hash;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;
  if (data.last_active_at !== undefined) updateData.last_active_at = data.last_active_at;
  if (data.token_balance !== undefined) updateData.token_balance = data.token_balance;
  if (data.gateway_url !== undefined) updateData.gateway_url = data.gateway_url;
  if (data.gateway_token !== undefined) updateData.gateway_token = data.gateway_token;
  if (data.gateway_hooks_token !== undefined) updateData.gateway_hooks_token = data.gateway_hooks_token;
  if (data.unique_machine !== undefined) updateData.unique_machine = data.unique_machine;
  if (data.auth_profiles_path !== undefined) updateData.auth_profiles_path = data.auth_profiles_path;
  if (data.cf_tunnel_id !== undefined) updateData.cf_tunnel_id = data.cf_tunnel_id;
  if (data.cf_tunnel_name !== undefined) updateData.cf_tunnel_name = data.cf_tunnel_name;
  if (data.cf_tunnel_domain !== undefined) updateData.cf_tunnel_domain = data.cf_tunnel_domain;
  if (data.cf_dns_record_id !== undefined) updateData.cf_dns_record_id = data.cf_dns_record_id;
  if (data.cf_provisioned_at !== undefined) updateData.cf_provisioned_at = data.cf_provisioned_at;

  if (Object.keys(updateData).length === 0) {
    return getUserById(id);
  }

  await getRepo().update({ id }, updateData);
  const result = await getRepo().findOneBy({ id });
  return result as unknown as User | null;
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<boolean> {
  const result = await getRepo().delete({ id });
  return (result.affected ?? 0) > 0;
}

/**
 * List all users (with pagination)
 */
export async function listUsers(options: {
  limit?: number;
  offset?: number;
  search?: string;
  role?: string;
  status?: string;
}): Promise<{ users: User[]; total: number }> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const qb = getRepo().createQueryBuilder("u");

  if (options.search) {
    qb.andWhere("(u.email ILIKE :search OR u.name ILIKE :search)", {
      search: `%${options.search}%`,
    });
  }

  if (options.role) {
    qb.andWhere("u.role = :role", { role: options.role });
  }

  if (options.status) {
    qb.andWhere("u.is_active = :is_active", { is_active: options.status === "active" });
  }

  qb.orderBy("u.created_at", "DESC").take(limit).skip(offset);

  const [users, total] = await qb.getManyAndCount();

  return {
    users: users as unknown as User[],
    total,
  };
}

/**
 * Update user token balance
 */
export async function updateTokenBalance(id: string, amount: number): Promise<User | null> {
  const result = await getRepo()
    .createQueryBuilder()
    .update()
    .set({ token_balance: () => "token_balance + :amount" })
    .setParameter("amount", amount)
    .where("id = :id", { id })
    .returning("*")
    .execute();

  return result.raw[0] as unknown as User | null;
}

/**
 * Check if user has enough tokens
 */
export async function hasEnoughTokens(id: string, amount: number): Promise<boolean> {
  const user = await getRepo().findOneBy({ id });
  return user ? user.token_balance >= amount : false;
}

export default {
  createUser,
  getUserById,
  getUserByEmail,
  getUserByMachine,
  updateUser,
  deleteUser,
  listUsers,
  updateTokenBalance,
  hasEnoughTokens,
};
