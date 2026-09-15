import type { Request, Response } from 'express';
import type { TagService } from '../application/tag.service.js';
import { ok, created, noContent } from '../../../shared/http/respond.js';

export function createTagController(tagService: TagService) {
  return {
    async getAll(_req: Request, res: Response) {
      const result = await tagService.list();
      ok(res, result);
    },

    async getById(req: Request, res: Response) {
      const result = await tagService.getById(req.params.id as string);
      ok(res, result);
    },

    async create(req: Request, res: Response) {
      const { name, color } = req.body;
      const result = await tagService.create(name, color);
      created(res, result, `/api/tags/${result.id}`);
    },

    async update(req: Request, res: Response) {
      const { name, color } = req.body;
      const result = await tagService.update(req.params.id as string, name, color);
      ok(res, result);
    },

    async remove(req: Request, res: Response) {
      await tagService.delete(req.params.id as string);
      noContent(res);
    },
  };
}
