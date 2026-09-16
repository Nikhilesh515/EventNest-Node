import { type RouteConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { registry } from './registry.js';

import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from '../../../modules/auth/http/auth.schemas.js';
import { updateUserSchema, listUsersSchema } from '../../../modules/auth/http/user.schemas.js';
import {
  grantSchema,
  revokeSchema,
  checkSchema,
} from '../../../modules/auth/http/permission.schemas.js';
import {
  createEventSchema,
  updateEventSchema,
  eventListQuerySchema,
  eventIdParamSchema,
} from '../../../modules/events/http/event.schemas.js';
import {
  createTagSchema,
  updateTagSchema,
  tagIdParamSchema,
} from '../../../modules/tags/http/tag.schemas.js';
import {
  createRsvpSchema,
  updateRsvpSchema,
  rsvpIdParamSchema,
  eventRsvpsParamSchema,
  userRsvpsParamSchema,
} from '../../../modules/rsvps/http/rsvp.schemas.js';

const userIdParam = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  request: { body: { content: { 'application/json': { schema: registerSchema.body } } } },
  responses: {
    200: { description: 'AuthResponseDto' },
    400: { description: 'Validation error' },
    409: { description: 'Email already exists' },
  },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Login',
  request: { body: { content: { 'application/json': { schema: loginSchema.body } } } },
  responses: {
    200: { description: 'AuthResponseDto' },
    401: { description: 'Invalid credentials' },
  },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'post',
  path: '/api/auth/refresh',
  tags: ['Auth'],
  summary: 'Refresh access token',
  request: { body: { content: { 'application/json': { schema: refreshSchema.body } } } },
  responses: {
    200: { description: 'AuthResponseDto' },
    401: { description: 'Invalid refresh token' },
  },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  tags: ['Auth'],
  summary: 'Logout (revoke refresh token)',
  request: { body: { content: { 'application/json': { schema: logoutSchema.body } } } },
  responses: { 204: { description: 'No content' } },
} as unknown as RouteConfig);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/users/me',
  tags: ['Users'],
  summary: 'Get current user',
  responses: { 200: { description: 'UserDto' }, 401: { description: 'Unauthorized' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/users',
  tags: ['Users'],
  summary: 'List users',
  request: { query: listUsersSchema.query },
  responses: { 200: { description: 'UserDto[]' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/users/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  request: { params: userIdParam },
  responses: { 200: { description: 'UserDto' }, 404: { description: 'Not found' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'put',
  path: '/api/users/{id}',
  tags: ['Users'],
  summary: 'Update user display name',
  request: {
    params: userIdParam,
    body: { content: { 'application/json': { schema: updateUserSchema.body } } },
  },
  responses: { 200: { description: 'UserDto' }, 404: { description: 'Not found' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'delete',
  path: '/api/users/{id}',
  tags: ['Users'],
  summary: 'Soft-delete a user',
  request: { params: userIdParam },
  responses: { 204: { description: 'No content' } },
} as unknown as RouteConfig);

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/permissions',
  tags: ['Permissions'],
  summary: 'List all permissions (catalog)',
  responses: { 200: { description: 'PermissionDto[]' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/permissions/user/{userId}',
  tags: ['Permissions'],
  summary: 'Get effective permissions for a user',
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: { 200: { description: 'PermissionDto[]' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/permissions/check',
  tags: ['Permissions'],
  summary: 'Check if a user has a permission',
  request: { query: checkSchema.query },
  responses: { 200: { description: 'boolean' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'post',
  path: '/api/permissions/grant',
  tags: ['Permissions'],
  summary: 'Grant a permission to a user',
  request: { body: { content: { 'application/json': { schema: grantSchema.body } } } },
  responses: { 200: { description: 'PermissionDto' }, 409: { description: 'Already granted' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'post',
  path: '/api/permissions/revoke',
  tags: ['Permissions'],
  summary: 'Revoke a permission from a user',
  request: { body: { content: { 'application/json': { schema: revokeSchema.body } } } },
  responses: { 204: { description: 'No content' } },
} as unknown as RouteConfig);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/tags',
  tags: ['Tags'],
  summary: 'List all tags',
  responses: { 200: { description: 'TagDto[]' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/tags/{id}',
  tags: ['Tags'],
  summary: 'Get tag by ID',
  request: { params: tagIdParamSchema.params },
  responses: { 200: { description: 'TagDto' }, 404: { description: 'Not found' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'post',
  path: '/api/tags',
  tags: ['Tags'],
  summary: 'Create a tag',
  request: { body: { content: { 'application/json': { schema: createTagSchema.body } } } },
  responses: { 201: { description: 'TagDto' }, 409: { description: 'Duplicate name' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'put',
  path: '/api/tags/{id}',
  tags: ['Tags'],
  summary: 'Update a tag',
  request: {
    params: tagIdParamSchema.params,
    body: { content: { 'application/json': { schema: updateTagSchema.body } } },
  },
  responses: { 200: { description: 'TagDto' }, 404: { description: 'Not found' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'delete',
  path: '/api/tags/{id}',
  tags: ['Tags'],
  summary: 'Delete a tag',
  request: { params: tagIdParamSchema.params },
  responses: { 204: { description: 'No content' } },
} as unknown as RouteConfig);

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/events',
  tags: ['Events'],
  summary: 'List events (paginated, optional auth)',
  request: { query: eventListQuerySchema.query },
  responses: { 200: { description: 'PagedResultDto<EventDto>' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/events/my',
  tags: ['Events'],
  summary: "List the caller's own events",
  responses: { 200: { description: 'EventDto[]' }, 401: { description: 'Unauthorized' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/events/{id}',
  tags: ['Events'],
  summary: 'Get event by ID (optional auth)',
  request: { params: eventIdParamSchema.params },
  responses: { 200: { description: 'EventDto' }, 404: { description: 'Not found' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'post',
  path: '/api/events',
  tags: ['Events'],
  summary: 'Create an event (Draft)',
  request: { body: { content: { 'application/json': { schema: createEventSchema.body } } } },
  responses: { 201: { description: 'EventDto' }, 409: { description: 'Duplicate title' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'put',
  path: '/api/events/{id}',
  tags: ['Events'],
  summary: 'Update an event (owner only)',
  request: {
    params: eventIdParamSchema.params,
    body: { content: { 'application/json': { schema: updateEventSchema.body } } },
  },
  responses: {
    200: { description: 'EventDto' },
    403: { description: 'Not owner' },
    404: { description: 'Not found' },
  },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'delete',
  path: '/api/events/{id}',
  tags: ['Events'],
  summary: 'Delete an event (owner only)',
  request: { params: eventIdParamSchema.params },
  responses: { 204: { description: 'No content' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'put',
  path: '/api/events/{id}/publish',
  tags: ['Events'],
  summary: 'Publish an event',
  request: { params: eventIdParamSchema.params },
  responses: { 200: { description: 'EventDto' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'put',
  path: '/api/events/{id}/cancel',
  tags: ['Events'],
  summary: 'Cancel an event',
  request: { params: eventIdParamSchema.params },
  responses: { 200: { description: 'EventDto' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'put',
  path: '/api/events/{id}/complete',
  tags: ['Events'],
  summary: 'Complete an event',
  request: { params: eventIdParamSchema.params },
  responses: { 200: { description: 'EventDto' } },
} as unknown as RouteConfig);

// ---------------------------------------------------------------------------
// RSVPs
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/events/{eventId}/rsvps',
  tags: ['RSVPs'],
  summary: 'Create an RSVP',
  request: {
    params: eventRsvpsParamSchema.params,
    body: { content: { 'application/json': { schema: createRsvpSchema.body } } },
  },
  responses: {
    201: { description: 'RsvpDto' },
    400: { description: 'Validation error' },
    409: { description: 'Already RSVPed' },
  },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'delete',
  path: '/api/events/{eventId}/rsvps',
  tags: ['RSVPs'],
  summary: 'Cancel own RSVP for an event',
  request: { params: eventRsvpsParamSchema.params },
  responses: { 204: { description: 'No content' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/events/{eventId}/rsvps',
  tags: ['RSVPs'],
  summary: 'List RSVPs for an event (manage permission)',
  request: { params: eventRsvpsParamSchema.params },
  responses: { 200: { description: 'RsvpDetailDto[]' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/rsvps/{id}',
  tags: ['RSVPs'],
  summary: 'Get RSVP by ID',
  request: { params: rsvpIdParamSchema.params },
  responses: { 200: { description: 'RsvpDto' }, 404: { description: 'Not found' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'put',
  path: '/api/rsvps/{id}',
  tags: ['RSVPs'],
  summary: 'Update own RSVP',
  request: {
    params: rsvpIdParamSchema.params,
    body: { content: { 'application/json': { schema: updateRsvpSchema.body } } },
  },
  responses: { 200: { description: 'RsvpDto' }, 404: { description: 'Not found' } },
} as unknown as RouteConfig);

registry.registerPath({
  method: 'get',
  path: '/api/users/{userId}/rsvps',
  tags: ['RSVPs'],
  summary: 'List RSVPs for a user',
  request: { params: userRsvpsParamSchema.params },
  responses: { 200: { description: 'RsvpDetailDto[]' } },
} as unknown as RouteConfig);

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  responses: {
    200: {
      description: 'Healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            checks: z.array(
              z.object({ name: z.string(), status: z.string(), durationMs: z.number() }),
            ),
          }),
        },
      },
    },
    503: { description: 'Unhealthy' },
  },
} as unknown as RouteConfig);
