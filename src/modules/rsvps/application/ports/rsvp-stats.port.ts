export interface RsvpStatsPort {
  getGoingCounts(eventIds: string[]): Promise<Record<string, number>>;
}
