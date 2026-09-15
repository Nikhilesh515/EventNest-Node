import { NotFoundError } from '../../../shared/domain/errors.js';
import type { RsvpRepository } from './rsvp.repository.js';
import { Rsvp, type RsvpStatus, RSVP_STATUSES } from '../domain/rsvp.js';
import {
  AlreadyRsvpedError,
  RsvpToUnpublishedEventError,
  CapacityExceededError,
  RsvpOwnershipError,
  InvalidRsvpStatusError,
} from '../domain/errors.js';
import type { EventLookupPort } from '../../events/application/ports/event-lookup.port.js';
import type { UserLookupPort } from '../../auth/application/ports/user-lookup.port.js';
import type { RsvpStatsPort } from './ports/rsvp-stats.port.js';
import type { RsvpDto, RsvpDetailDto, CreateRsvpInput, UpdateRsvpInput } from './dto/rsvp.dto.js';

const VALID_STATUSES = new Set<string>(RSVP_STATUSES);

export class RsvpService implements RsvpStatsPort {
  constructor(
    private readonly rsvps: RsvpRepository,
    private readonly eventLookup: EventLookupPort,
    private readonly userLookup: UserLookupPort,
  ) {}

  async create(
    eventId: string,
    input: CreateRsvpInput,
    userId: string,
    userName: string,
  ): Promise<RsvpDto> {
    const event = await this.eventLookup.getEvent(eventId);
    if (!event) throw new NotFoundError(`Event '${eventId}' not found.`);
    if (event.status !== 'Published') throw new RsvpToUnpublishedEventError(eventId);

    const existing = await this.rsvps.findByEventAndUser(eventId, userId);

    if (existing && existing.status !== 'Cancelled') {
      throw new AlreadyRsvpedError();
    }

    const guestCount = Math.max(input.guestCount ?? 1, 1);

    if (existing) {
      const taken = await this.rsvps.sumGuestCountByEvent(eventId, 'Cancelled');
      if (taken + guestCount > event.capacity) {
        throw new CapacityExceededError(event.capacity - taken);
      }
      existing.updateGuestCount(guestCount);
      existing.updateNotes(input.notes ?? null);
      existing.updateStatus('Confirmed');
      const updated = await this.rsvps.update(existing);
      return this.toDto(updated);
    }

    const taken = await this.rsvps.sumGuestCountByEvent(eventId, 'Cancelled');
    if (taken + guestCount > event.capacity) {
      throw new CapacityExceededError(event.capacity - taken);
    }

    const rsvp = Rsvp.create({
      eventId,
      userId,
      userName,
      guestCount,
      notes: input.notes ?? null,
    });

    const created = await this.rsvps.create(rsvp);
    return this.toDto(created);
  }

  async cancelOwn(eventId: string, userId: string): Promise<void> {
    const rsvp = await this.rsvps.findByEventAndUser(eventId, userId);
    if (!rsvp) throw new NotFoundError('RSVP not found for this event.');
    rsvp.updateStatus('Cancelled');
    await this.rsvps.update(rsvp);
  }

  async update(id: string, input: UpdateRsvpInput, userId: string): Promise<RsvpDto> {
    const rsvp = await this.rsvps.findById(id);
    if (!rsvp) throw new NotFoundError(`RSVP '${id}' not found.`);
    if (rsvp.userId !== userId) throw new RsvpOwnershipError();

    if (input.status !== undefined) {
      if (!VALID_STATUSES.has(input.status)) {
        throw new InvalidRsvpStatusError(input.status);
      }
      rsvp.updateStatus(input.status as RsvpStatus);
    }

    if (input.guestCount !== undefined) {
      const newGuestCount = Math.max(input.guestCount, 1);
      const guestCountDiff = newGuestCount - rsvp.guestCount;
      if (guestCountDiff > 0) {
        const taken = await this.rsvps.sumGuestCountByEvent(rsvp.eventId, 'Cancelled');
        const event = await this.eventLookup.getEvent(rsvp.eventId);
        if (event && taken + guestCountDiff > event.capacity) {
          throw new CapacityExceededError(event.capacity - taken);
        }
      }
      rsvp.updateGuestCount(newGuestCount);
    }

    if (input.notes !== undefined) {
      rsvp.updateNotes(input.notes);
    }

    const updated = await this.rsvps.update(rsvp);
    return this.toDto(updated);
  }

  async getById(id: string): Promise<RsvpDto> {
    const rsvp = await this.rsvps.findById(id);
    if (!rsvp) throw new NotFoundError(`RSVP '${id}' not found.`);
    return this.toDto(rsvp);
  }

  async listByEvent(eventId: string): Promise<RsvpDetailDto[]> {
    const items = await this.rsvps.listByEventWithEventTitle(eventId);
    return items.map((i) => this.toDetailDto(i.rsvp, i.eventTitle));
  }

  async listByUser(userId: string): Promise<RsvpDetailDto[]> {
    const items = await this.rsvps.listByUserWithEventTitle(userId);
    return items.map((i) => this.toDetailDto(i.rsvp, i.eventTitle));
  }

  async getGoingCounts(eventIds: string[]): Promise<Record<string, number>> {
    return this.rsvps.getGoingCounts(eventIds);
  }

  private toDto(rsvp: Rsvp): RsvpDto {
    return {
      id: rsvp.id,
      eventId: rsvp.eventId,
      userId: rsvp.userId,
      userName: rsvp.userName,
      status: rsvp.status,
      guestCount: rsvp.guestCount,
      notes: rsvp.notes,
      respondedAt: rsvp.respondedAt.toISOString(),
      createdAt: rsvp.createdAt.toISOString(),
      updatedAt: rsvp.updatedAt.toISOString(),
    };
  }

  private toDetailDto(rsvp: Rsvp, eventTitle: string | null): RsvpDetailDto {
    return { ...this.toDto(rsvp), eventTitle };
  }
}
