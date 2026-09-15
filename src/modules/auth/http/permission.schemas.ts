import { z } from 'zod';
import type { ValidationSchemas } from '../../../shared/http/middleware/validate.js';

export const grantSchema: ValidationSchemas = {
  body: z.object({
    userId: z.string().uuid(),
    permissionName: z.string().min(1).max(100),
    expiresAt: z.string().datetime().nullable().optional(),
  }),
};

export const revokeSchema: ValidationSchemas = {
  body: z.object({
    userId: z.string().uuid(),
    permissionName: z.string().min(1).max(100),
  }),
};

export const checkSchema: ValidationSchemas = {
  query: z.object({
    userId: z.string().uuid(),
    permission: z.string().min(1).max(100),
  }),
};
