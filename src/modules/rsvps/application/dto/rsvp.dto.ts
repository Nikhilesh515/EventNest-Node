export interface RsvpDto {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  status: string;
  guestCount: number;
  notes: string | null;
  respondedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RsvpDetailDto extends RsvpDto {
  eventTitle: string | null;
  eventStartsAt: string | null;
  eventLocation: string | null;
}

export interface CreateRsvpInput {
  guestCount?: number;
  notes?: string | null;
}

export interface UpdateRsvpInput {
  status?: string;
  guestCount?: number;
  notes?: string | null;
}
