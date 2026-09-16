import type { Request, Response } from 'express';
import type { EventService } from '../application/event.service.js';
import { ok, created, noContent } from '../../../shared/http/respond.js';
import { UnauthorizedError } from '../../../shared/domain/errors.js';

const FULL_ACCESS_ROLES = new Set(['Admin', 'SuperAdmin']);

function getCallerPermissions(req: Request): string[] {
  if (!req.user) return [];
  if (FULL_ACCESS_ROLES.has(req.user.role)) {
    return ['Events.Edit', 'Events.Delete'];
  }
  return [];
}

function requireUser(req: Request): { id: string; name: string } {
  if (!req.user) throw new UnauthorizedError('Authentication required.');
  return { id: req.user.id, name: req.user.name };
}

export function createEventController(eventService: EventService) {
  return {
    async create(req: Request, res: Response) {
      const user = requireUser(req);
      const result = await eventService.create(req.body, user.id, user.name);
      created(res, result, `/api/events/${result.id}`);
    },

    async list(req: Request, res: Response) {
      const perms = getCallerPermissions(req);
      const query = { ...req.query } as Record<string, unknown>;
      if (query.tagId && !Array.isArray(query.tagId)) {
        query.tagId = [query.tagId];
      }
      const result = await eventService.list(query as never, perms);
      ok(res, result);
    },

    async getMyEvents(req: Request, res: Response) {
      const user = requireUser(req);
      const result = await eventService.getMyEvents(user.id);
      ok(res, result);
    },

    async getById(req: Request, res: Response) {
      const perms = getCallerPermissions(req);
      const userId = req.user?.id;
      const result = await eventService.getById(req.params.id as string, perms, userId);
      ok(res, result);
    },

    async update(req: Request, res: Response) {
      const user = requireUser(req);
      const result = await eventService.update(req.params.id as string, req.body, user.id);
      ok(res, result);
    },

    async remove(req: Request, res: Response) {
      const user = requireUser(req);
      await eventService.delete(req.params.id as string, user.id);
      noContent(res);
    },

    async publish(req: Request, res: Response) {
      const user = requireUser(req);
      const result = await eventService.publish(req.params.id as string, user.id);
      ok(res, result);
    },

    async cancel(req: Request, res: Response) {
      const user = requireUser(req);
      const result = await eventService.cancel(req.params.id as string, user.id);
      ok(res, result);
    },

    async complete(req: Request, res: Response) {
      const user = requireUser(req);
      const result = await eventService.complete(req.params.id as string, user.id);
      ok(res, result);
    },
  };
}
