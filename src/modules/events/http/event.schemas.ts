import { z } from 'zod';
import type { ValidationSchemas } from '../../../shared/http/middleware/validate.js';

export const createEventSchema: ValidationSchemas = {
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullish(),
    location: z.string().max(300).nullish(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.number().int().min(1),
    tagIds: z.array(z.string().uuid()).optional(),
  }),
};

export const updateEventSchema: ValidationSchemas = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullish(),
    location: z.string().max(300).nullish(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.number().int().min(1),
    tagIds: z.array(z.string().uuid()).optional(),
  }),
};

export const eventListQuerySchema: ValidationSchemas = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    tagId: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
    visibility: z.enum(['Public', 'Private']).optional(),
    status: z.enum(['Draft', 'Published', 'Cancelled', 'Completed']).optional(),
    timeframe: z.enum(['upcoming', 'past', 'all']).optional(),
    sort: z.enum(['date-asc', 'date-desc', 'created-desc', 'popularity']).optional(),
  }),
};

export const eventIdParamSchema: ValidationSchemas = {
  params: z.object({ id: z.string().uuid() }),
};
