import type { Request, Response } from 'express';
import type { RsvpService } from '../application/rsvp.service.js';
import { ok, created, noContent } from '../../../shared/http/respond.js';
import { UnauthorizedError } from '../../../shared/domain/errors.js';

function requireUser(req: Request): { id: string; name: string } {
  if (!req.user) throw new UnauthorizedError('Authentication required.');
  return { id: req.user.id, name: req.user.name };
}

export function createRsvpController(rsvpService: RsvpService) {
  return {
    async create(req: Request, res: Response) {
      const user = requireUser(req);
      const eventId = req.params.eventId as string;
      const result = await rsvpService.create(eventId, req.body, user.id, user.name);
      created(res, result, `/api/rsvps/${result.id}`);
    },

    async cancelOwn(req: Request, res: Response) {
      const user = requireUser(req);
      const eventId = req.params.eventId as string;
      await rsvpService.cancelOwn(eventId, user.id);
      noContent(res);
    },

    async listByEvent(req: Request, res: Response) {
      const eventId = req.params.eventId as string;
      const result = await rsvpService.listByEvent(eventId);
      ok(res, result);
    },

    async getById(req: Request, res: Response) {
      const result = await rsvpService.getById(req.params.id as string);
      ok(res, result);
    },

    async update(req: Request, res: Response) {
      const user = requireUser(req);
      const result = await rsvpService.update(req.params.id as string, req.body, user.id);
      ok(res, result);
    },

    async listByUser(req: Request, res: Response) {
      const userId = req.params.userId as string;
      const result = await rsvpService.listByUser(userId);
      ok(res, result);
    },
  };
}
