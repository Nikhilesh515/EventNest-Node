import {
  ConflictError,
  ValidationError,
  UnauthorizedError,
} from '../../../shared/domain/errors.js';
import type { FieldErrors } from '../../../shared/domain/errors.js';

export class AlreadyRsvpedError extends ConflictError {
  constructor() {
    super("Already RSVP'd to this event.");
  }
}

export class RsvpToUnpublishedEventError extends ValidationError {
  constructor(eventId: string) {
    const errors: FieldErrors = { eventId: [`Event '${eventId}' is not published.`] };
    super('Cannot RSVP to a non-published event.', errors);
  }
}

export class CapacityExceededError extends ValidationError {
  constructor(remaining: number) {
    const errors: FieldErrors = {
      guestCount: [`Event has reached maximum capacity. Remaining: ${remaining}.`],
    };
    super('Event has reached maximum capacity.', errors);
  }
}

export class RsvpOwnershipError extends UnauthorizedError {
  constructor() {
    super('You can only update your own RSVP.');
  }
}

export class InvalidRsvpStatusError extends ValidationError {
  constructor(status: string) {
    const errors: FieldErrors = { status: [`Invalid RSVP status: '${status}'.`] };
    super('Invalid RSVP status.', errors);
  }
}
