import type { Knex } from 'knex';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env.js';
import type { TagLookupPort } from './application/ports/tag-lookup.port.js';
import type { UserLookupPort } from '../auth/application/ports/user-lookup.port.js';
import { KnexEventRepository } from './infrastructure/event.knex-repository.js';
import { EventService } from './application/event.service.js';
import { createEventRoutes } from './http/event.routes.js';

export interface EventsModuleDeps {
  knex: Knex;
  config: AppConfig;
  logger: Logger;
  tagLookup: TagLookupPort;
  userLookup: UserLookupPort;
}

export function buildEventsModule(deps: EventsModuleDeps) {
  const eventRepo = new KnexEventRepository(deps.knex);
  const eventService = new EventService(eventRepo, deps.tagLookup, deps.userLookup);
  const eventRouter = createEventRoutes(eventService);

  return {
    services: { events: eventService },
    providers: { eventLookup: eventService },
    routers: [eventRouter],
  };
}
