import { NotFoundError } from '../../../shared/domain/errors.js';
import type { TagRepository } from './tag.repository.js';
import { Tag } from '../domain/tag.js';
import { TagAlreadyExistsError } from '../domain/errors.js';
import type { TagDto } from './dto/tag.dto.js';
import type { TagLookupPort, TagSummary } from './ports/tag-lookup.port.js';

export class TagService implements TagLookupPort {
  constructor(private readonly tags: TagRepository) {}

  async list(): Promise<TagDto[]> {
    const tags = await this.tags.list();
    return tags.map((t) => this.toDto(t));
  }

  async getById(id: string): Promise<TagDto> {
    const tag = await this.tags.findById(id);
    if (!tag) throw new NotFoundError(`Tag '${id}' not found.`);
    return this.toDto(tag);
  }

  async create(name: string, color: string): Promise<TagDto> {
    const existing = await this.tags.findByName(name);
    if (existing) throw new TagAlreadyExistsError(name);
    const tag = Tag.create(name, color);
    const created = await this.tags.create(tag);
    return this.toDto(created);
  }

  async update(id: string, name: string, color: string): Promise<TagDto> {
    const tag = await this.tags.findById(id);
    if (!tag) throw new NotFoundError(`Tag '${id}' not found.`);
    const existing = await this.tags.findByName(name);
    if (existing && existing.id !== id) throw new TagAlreadyExistsError(name);
    tag.updateName(name);
    tag.updateColor(color);
    const updated = await this.tags.update(tag);
    return this.toDto(updated);
  }

  async delete(id: string): Promise<void> {
    const tag = await this.tags.findById(id);
    if (!tag) throw new NotFoundError(`Tag '${id}' not found.`);
    await this.tags.delete(id);
  }

  async getTags(ids: string[]): Promise<TagSummary[]> {
    const tags = await this.tags.findByIds(ids);
    return tags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  }

  private toDto(tag: Tag): TagDto {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
    };
  }
}
