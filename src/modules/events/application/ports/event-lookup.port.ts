export interface EventSummary {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  organizerId: string;
  status: string;
  capacity: number;
}

export interface EventLookupPort {
  getEvent(id: string): Promise<EventSummary | null>;
}
