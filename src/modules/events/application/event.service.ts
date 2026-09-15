import { NotFoundError, ForbiddenError } from '../../../shared/domain/errors.js';
import type { EventRepository, EventListFilters } from './event.repository.js';
import { Event, type EventTagSnapshot } from '../domain/event.js';
import { DuplicateEventTitleError, InvalidTagError } from '../domain/errors.js';
import type { TagLookupPort } from './ports/tag-lookup.port.js';
import type { UserLookupPort } from '../../auth/application/ports/user-lookup.port.js';
import type { EventLookupPort, EventSummary } from './ports/event-lookup.port.js';
import type { RsvpStatsPort } from '../../rsvps/application/ports/rsvp-stats.port.js';
import type {
  EventDto,
  PaginatedEventsDto,
  CreateEventInput,
  UpdateEventInput,
  EventFilters,
} from './dto/event.dto.js';

const HAS_EVENT_MANAGE = ['Events.Edit', 'Events.Delete'];

export class EventService implements EventLookupPort {
  constructor(
    private readonly events: EventRepository,
    private readonly tags: TagLookupPort,
    private readonly users: UserLookupPort,
    private readonly rsvpStats?: RsvpStatsPort,
  ) {}

  async create(input: CreateEventInput, userId: string, userName: string): Promise<EventDto> {
    const existing = await this.events.findByTitle(input.title);
    if (existing) throw new DuplicateEventTitleError(input.title);

    const tagSnapshots = await this.resolveTags(input.tagIds ?? []);

    const event = Event.create({
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      capacity: input.capacity,
      organizerId: userId,
      organizerName: userName,
      tags: tagSnapshots,
    });

    const created = await this.events.create(event);
    await this.events.setTags(created.id, tagSnapshots);
    return this.toDto(created);
  }

  async list(filters: EventFilters, callerPerms: string[] = []): Promise<PaginatedEventsDto> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const canManage = callerPerms.some((p) => HAS_EVENT_MANAGE.includes(p));

    const listFilters: EventListFilters = {
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };
    if (filters.search) listFilters.search = filters.search;
    if (filters.tagId) listFilters.tagId = filters.tagId;
    if (filters.visibility) listFilters.visibility = filters.visibility as EventListFilters['visibility'];
    if (filters.timeframe) listFilters.timeframe = filters.timeframe;
    if (filters.sort) listFilters.sort = filters.sort;

    if (canManage) {
      if (filters.status) listFilters.status = filters.status as EventListFilters['status'];
    } else {
      listFilters.status = 'Published';
    }

    const { offset: _offset, limit: _limit, ...countFilters } = listFilters;
    const [items, total] = await Promise.all([
      this.events.list(listFilters),
      this.events.count(countFilters),
    ]);

    const [goingCounts, maybeCounts] = this.rsvpStats
      ? await Promise.all([
          this.rsvpStats.getGoingCounts(items.map((e) => e.id)),
          this.rsvpStats.getMaybeCounts(items.map((e) => e.id)),
        ])
      : [{}, {}];
    const enriched = await Promise.all(
      items.map((e) => this.toDto(e, goingCounts[e.id] ?? 0, maybeCounts[e.id] ?? 0)),
    );

    return {
      items: enriched,
      total,
      page,
      size: pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }

  async getMyEvents(userId: string): Promise<EventDto[]> {
    const items = await this.events.listByOrganizer(userId);
    const [goingCounts, maybeCounts] = this.rsvpStats
      ? await Promise.all([
          this.rsvpStats.getGoingCounts(items.map((e) => e.id)),
          this.rsvpStats.getMaybeCounts(items.map((e) => e.id)),
        ])
      : [{}, {}];
    return Promise.all(
      items.map((e) => this.toDto(e, goingCounts[e.id] ?? 0, maybeCounts[e.id] ?? 0)),
    );
  }

  async getById(
    id: string,
    callerPerms: string[] = [],
    userId?: string,
  ): Promise<EventDto> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError(`Event '${id}' not found.`);

    if (event.status !== 'Published') {
      const canManage = callerPerms.some((p) => HAS_EVENT_MANAGE.includes(p));
      const isOwner = userId === event.organizerId;
      if (!canManage || !isOwner) {
        throw new NotFoundError(`Event '${id}' not found.`);
      }
    }

    const [goingCounts, maybeCounts] = this.rsvpStats
      ? await Promise.all([
          this.rsvpStats.getGoingCounts([event.id]),
          this.rsvpStats.getMaybeCounts([event.id]),
        ])
      : [{}, {}];
    return this.toDto(event, goingCounts[event.id] ?? 0, maybeCounts[event.id] ?? 0);
  }

  async update(id: string, input: UpdateEventInput, userId: string): Promise<EventDto> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError(`Event '${id}' not found.`);
    this.checkOwnership(event, userId);

    const existing = await this.events.findByTitle(input.title);
    if (existing && existing.id !== id) throw new DuplicateEventTitleError(input.title);

    const tagSnapshots = await this.resolveTags(input.tagIds ?? []);

    event.update({
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      capacity: input.capacity,
      tags: tagSnapshots,
    });

    const updated = await this.events.update(event);
    await this.events.setTags(id, tagSnapshots);
    return this.toDto(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError(`Event '${id}' not found.`);
    this.checkOwnership(event, userId);
    await this.events.delete(id);
  }

  async publish(id: string, userId: string): Promise<EventDto> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError(`Event '${id}' not found.`);
    this.checkOwnership(event, userId);
    event.publish();
    const updated = await this.events.update(event);
    return this.toDto(updated);
  }

  async cancel(id: string, userId: string): Promise<EventDto> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError(`Event '${id}' not found.`);
    this.checkOwnership(event, userId);
    event.cancel();
    const updated = await this.events.update(event);
    return this.toDto(updated);
  }

  async complete(id: string, userId: string): Promise<EventDto> {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundError(`Event '${id}' not found.`);
    this.checkOwnership(event, userId);
    event.complete();
    const updated = await this.events.update(event);
    return this.toDto(updated);
  }

  async getEvent(id: string): Promise<EventSummary | null> {
    const event = await this.events.findById(id);
    if (!event) return null;
    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      organizerId: event.organizerId,
      status: event.status,
      capacity: event.capacity,
    };
  }

  private async resolveTags(tagIds: string[]): Promise<EventTagSnapshot[]> {
    if (tagIds.length === 0) return [];
    const found = await this.tags.getTags(tagIds);
    if (found.length !== tagIds.length) {
      const foundIds = new Set(found.map((t) => t.id));
      const unknown = tagIds.filter((id) => !foundIds.has(id));
      throw new InvalidTagError(unknown);
    }
    return found.map((t) => ({ tagId: t.id, tagName: t.name }));
  }

  private checkOwnership(event: Event, userId: string): void {
    if (event.organizerId !== userId) {
      throw new ForbiddenError('You do not have permission to modify this event.');
    }
  }

  private async toDto(event: Event, goingCount = 0, maybeCount = 0): Promise<EventDto> {
    const tagDtos = await Promise.all(
      event.tags.map(async (t) => {
        const summaries = await this.tags.getTags([t.tagId]);
        const tag = summaries[0];
        return tag ?? { id: t.tagId, name: t.tagName, color: '#000000' };
      }),
    );

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      capacity: event.capacity,
      goingCount,
      maybeCount,
      organizerId: event.organizerId,
      organizerName: event.organizerName,
      status: event.status,
      visibility: event.visibility,
      tags: tagDtos,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
