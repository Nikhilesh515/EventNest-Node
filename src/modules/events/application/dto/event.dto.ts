export interface EventTagDto {
  id: string;
  name: string;
  color: string;
}

export interface EventDto {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  goingCount: number;
  organizerId: string;
  organizerName: string;
  status: string;
  visibility: string;
  tags: EventTagDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEventsDto {
  items: EventDto[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  tagIds?: string[];
}

export type UpdateEventInput = CreateEventInput;

export interface EventFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  tagId?: string[];
  visibility?: string;
  status?: string;
  timeframe?: 'upcoming' | 'past' | 'all';
  sort?: string;
}
