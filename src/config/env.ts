import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/eventnest'),
  REDIS_URL: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
  CACHE_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long (use a random string)'),
  JWT_ISSUER: z.string().default('EventNest.AuthService'),
  JWT_AUDIENCE: z.string().default('EventNest'),
  JWT_ACCESS_EXPIRY_MINUTES: z.coerce.number().int().positive().default(60),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OPENAPI_ENABLED: booleanFromString,
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`,
    );
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    });
    throw new ConfigError(issues);
  }

  return result.data;
}
