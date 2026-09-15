import type { Knex } from 'knex';
import type { Logger } from 'pino';
import type { AppConfig } from '../../config/env.js';
import type { EventLookupPort } from '../events/application/ports/event-lookup.port.js';
import type { UserLookupPort } from '../auth/application/ports/user-lookup.port.js';
import { KnexRsvpRepository } from './infrastructure/rsvp.knex-repository.js';
import { RsvpService } from './application/rsvp.service.js';
import { createRsvpRoutes } from './http/rsvp.routes.js';

export interface RsvpsModuleDeps {
  knex: Knex;
  config: AppConfig;
  logger: Logger;
  eventLookup: EventLookupPort;
  userLookup: UserLookupPort;
}

export function buildRsvpsModule(deps: RsvpsModuleDeps) {
  const rsvpRepo = new KnexRsvpRepository(deps.knex);
  const rsvpService = new RsvpService(rsvpRepo, deps.eventLookup, deps.userLookup);
  const rsvpRouter = createRsvpRoutes(rsvpService);

  return {
    services: { rsvps: rsvpService },
    providers: { rsvpStats: rsvpService },
    routers: [rsvpRouter],
  };
}
