import request from 'supertest';
import bcrypt from 'bcrypt';
import type { Knex } from 'knex';
import type { Express } from 'express';

export const REFRESH_COOKIE = 'eventnest.refresh_token';

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

export interface AuthSession {
  accessToken: string;
  userId: string;
  cookie: string;
}

export function setCookieHeaders(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

export function refreshCookie(res: request.Response): string {
  const raw = setCookieHeaders(res).find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!raw) throw new Error('refresh cookie not set');
  const pair = raw.split(';')[0];
  if (!pair || pair === `${REFRESH_COOKIE}=`) throw new Error('refresh cookie not set');
  return pair;
}

function toSession(res: request.Response): AuthSession {
  return {
    accessToken: res.body.result.accessToken,
    userId: res.body.result.user.id,
    cookie: refreshCookie(res),
  };
}

export async function registerUser(
  app: Express,
  email: string,
  password: string,
  displayName: string,
): Promise<AuthSession> {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password,
    displayName,
  });
  return toSession(res);
}

export async function loginUser(
  app: Express,
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await request(app).post('/api/auth/login').send({
    email,
    password,
  });
  return toSession(res);
}
