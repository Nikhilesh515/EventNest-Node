export type EventStatus = 'Draft' | 'Published' | 'Cancelled' | 'Completed';
export type EventVisibility = 'Public' | 'Private';

export const EVENT_STATUSES: readonly EventStatus[] = [
  'Draft',
  'Published',
  'Cancelled',
  'Completed',
];
export const EVENT_VISIBILITIES: readonly EventVisibility[] = ['Public', 'Private'];

export interface EventTagSnapshot {
  tagId: string;
  tagName: string;
}

export interface EventProps {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  organizerId: string;
  organizerName: string;
  status: EventStatus;
  visibility: EventVisibility;
  tags: EventTagSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

export class Event {
  readonly id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  readonly organizerId: string;
  organizerName: string;
  status: EventStatus;
  visibility: EventVisibility;
  tags: EventTagSnapshot[];
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: EventProps) {
    this.id = props.id;
    this.title = props.title;
    this.description = props.description;
    this.location = props.location;
    this.startsAt = props.startsAt;
    this.endsAt = props.endsAt;
    this.capacity = props.capacity;
    this.organizerId = props.organizerId;
    this.organizerName = props.organizerName;
    this.status = props.status;
    this.visibility = props.visibility;
    this.tags = props.tags;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: {
    title: string;
    description?: string | null;
    location?: string | null;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    organizerId: string;
    organizerName: string;
    tags?: EventTagSnapshot[];
  }): Event {
    return new Event({
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      organizerId: input.organizerId,
      organizerName: input.organizerName,
      status: 'Draft',
      visibility: 'Public',
      tags: input.tags ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: EventProps): Event {
    return new Event(props);
  }

  publish(): void {
    this.status = 'Published';
    this.updatedAt = new Date();
  }

  cancel(): void {
    this.status = 'Cancelled';
    this.updatedAt = new Date();
  }

  complete(): void {
    this.status = 'Completed';
    this.updatedAt = new Date();
  }

  update(input: {
    title: string;
    description?: string | null;
    location?: string | null;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    tags: EventTagSnapshot[];
  }): void {
    this.title = input.title;
    this.description = input.description ?? null;
    this.location = input.location ?? null;
    this.startsAt = input.startsAt;
    this.endsAt = input.endsAt;
    this.capacity = input.capacity;
    this.tags = input.tags;
    this.updatedAt = new Date();
  }
}
