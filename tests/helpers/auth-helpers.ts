import request from 'supertest';
import bcrypt from 'bcrypt';
import type { Knex } from 'knex';
import type { Express } from 'express';
import type { TestAppContext } from './test-setup.js';

export async function createTestUser(
  knex: Knex,
  email: string,
  password: string,
  displayName: string,
  isActive = true,
): Promise<{ id: string }> {
  const role = await knex('roles').where('name', 'User').first();
  if (!role) throw new Error('User role not found — run seeds first');
  const passwordHash = await bcrypt.hash(password, 4);
  const [user] = await knex('users')
    .insert({
      id: crypto.randomUUID(),
      email,
      display_name: displayName,
      password_hash: passwordHash,
      role_id: role.id,
      is_active: isActive,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('id');
  return user;
}

export async function registerUser(
  app: Express,
  email: string,
  password: string,
  displayName: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password,
    displayName,
  });
  return {
    accessToken: res.body.result.accessToken,
    refreshToken: res.body.result.refreshToken,
    userId: res.body.result.user.id,
  };
}

export async function loginUser(
  app: Express,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const res = await request(app).post('/api/auth/login').send({
    email,
    password,
  });
  return {
    accessToken: res.body.result.accessToken,
    refreshToken: res.body.result.refreshToken,
    userId: res.body.result.user.id,
  };
}
