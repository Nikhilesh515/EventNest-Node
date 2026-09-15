export interface TagSummary {
  id: string;
  name: string;
  color: string;
}

export interface TagLookupPort {
  getTags(ids: string[]): Promise<TagSummary[]>;
}
