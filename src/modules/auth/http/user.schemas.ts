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
  }),
};
