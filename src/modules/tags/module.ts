import type { Knex } from 'knex';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env.js';
import { KnexTagRepository } from './infrastructure/tag.knex-repository.js';
import { TagService } from './application/tag.service.js';
import { createTagRoutes } from './http/tag.routes.js';

export interface TagsModuleDeps {
  knex: Knex;
  config: AppConfig;
  logger: Logger;
}

export function buildTagsModule(deps: TagsModuleDeps) {
  const tagRepo = new KnexTagRepository(deps.knex);
  const tagService = new TagService(tagRepo);
  const tagRouter = createTagRoutes(tagService);

  return {
    services: { tags: tagService },
    routers: [tagRouter],
  };
}
