import request from 'supertest';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { buildTestApp, destroyTestApp, type TestAppContext } from '../../helpers/auth-app.js';

let ctx: TestAppContext;

beforeAll(async () => {
  ctx = await buildTestApp();
});

afterAll(async () => {
  await destroyTestApp(ctx);
});

describe('debug register', () => {
  it('should return 200', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({
        email: 'debug-register@test.example.com',
        password: 'password123',
        displayName: 'Debug User',
      });

    console.log('STATUS:', res.status);
    console.log('BODY:', JSON.stringify(res.body, null, 2));
  });
});
