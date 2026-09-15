import { z } from 'zod';
import type { ValidationSchemas } from '../../../shared/http/middleware/validate.js';

export const createRsvpSchema: ValidationSchemas = {
  params: z.object({ eventId: z.string().uuid() }),
  body: z.object({
    guestCount: z.number().int().min(0).optional(),
    notes: z.string().max(1000).nullish(),
  }),
};

export const updateRsvpSchema: ValidationSchemas = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['Confirmed', 'Maybe', 'Declined', 'Cancelled']).optional(),
    guestCount: z.number().int().min(1).optional(),
    notes: z.string().max(1000).nullish(),
  }),
};

export const rsvpIdParamSchema: ValidationSchemas = {
  params: z.object({ id: z.string().uuid() }),
};

export const eventRsvpsParamSchema: ValidationSchemas = {
  params: z.object({ eventId: z.string().uuid() }),
};

export const userRsvpsParamSchema: ValidationSchemas = {
  params: z.object({ userId: z.string().uuid() }),
};
