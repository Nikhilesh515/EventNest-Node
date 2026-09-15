import { z } from 'zod';
import type { ValidationSchemas } from '../../../shared/http/middleware/validate.js';

export const createTagSchema: ValidationSchemas = {
  body: z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
};

export const updateTagSchema: ValidationSchemas = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
};

export const tagIdParamSchema: ValidationSchemas = {
  params: z.object({ id: z.string().uuid() }),
};
