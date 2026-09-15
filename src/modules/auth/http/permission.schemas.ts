import { z } from 'zod';

export const grantSchema = {
  body: z.object({
    userId: z.string().uuid(),
    permissionName: z.string().min(1),
    expiresAt: z.string().datetime().optional(),
  }),
};

export const revokeSchema = {
  body: z.object({
    userId: z.string().uuid(),
    permissionName: z.string().min(1),
  }),
};
