import { z } from 'zod';
import { ALL_PERMISSIONS } from '../../../shared/application/permissions.js';

export const createRoleSchema = {
  body: z.object({
    name: z.string().min(1).max(50),
    displayName: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    permissionNames: z.array(z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]])).min(1),
  }),
};

export const updateRoleSchema = {
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    displayName: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    permissionNames: z
      .array(z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]]))
      .optional(),
  }),
};

export const roleIdParamSchema = {
  params: z.object({ id: z.string().uuid() }),
};

export const assignUserRoleSchema = {
  body: z.object({ roleId: z.string().uuid() }),
};
