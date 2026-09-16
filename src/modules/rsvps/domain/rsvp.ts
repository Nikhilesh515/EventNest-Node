export type RsvpStatus = 'Confirmed' | 'Maybe' | 'Declined' | 'Cancelled';

export const RSVP_STATUSES: readonly RsvpStatus[] = ['Confirmed', 'Maybe', 'Declined', 'Cancelled'];

export interface RsvpProps {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  status: RsvpStatus;
  guestCount: number;
  notes: string | null;
  respondedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Rsvp {
  readonly id: string;
  readonly eventId: string;
  readonly userId: string;
  userName: string;
  status: RsvpStatus;
  guestCount: number;
  notes: string | null;
  respondedAt: Date;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: RsvpProps) {
    this.id = props.id;
    this.eventId = props.eventId;
    this.userId = props.userId;
    this.userName = props.userName;
    this.status = props.status;
    this.guestCount = props.guestCount;
    this.notes = props.notes;
    this.respondedAt = props.respondedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: {
    eventId: string;
    userId: string;
    userName: string;
    guestCount?: number;
    notes?: string | null;
  }): Rsvp {
    const guestCount = Math.max(input.guestCount ?? 1, 1);
    return new Rsvp({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      userId: input.userId,
      userName: input.userName,
      status: 'Confirmed',
      guestCount,
      notes: input.notes ?? null,
      respondedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: RsvpProps): Rsvp {
    return new Rsvp(props);
  }

  updateStatus(status: RsvpStatus): void {
    this.status = status;
    this.respondedAt = new Date();
    this.updatedAt = new Date();
  }

  updateGuestCount(guestCount: number): void {
    this.guestCount = Math.max(guestCount, 1);
    this.updatedAt = new Date();
  }

  updateNotes(notes: string | null): void {
    this.notes = notes;
    this.updatedAt = new Date();
  }
}
