import { z } from 'zod';

export const updateUserSchema = {
  body: z.object({
    displayName: z.string().min(1).max(100),
  }),
};

export const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(200).optional(),
    role: z.string().uuid().optional(),
  }),
};

export const createAdminUserSchema = {
  body: z.object({
    email: z.string().email(),
    displayName: z.string().min(1).max(100),
    password: z.string().min(8).max(128),
    roleId: z.string().uuid(),
  }),
};
