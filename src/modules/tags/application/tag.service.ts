import { NotFoundError } from '../../../shared/domain/errors.js';
import type { TagRepository } from './tag.repository.js';
import { Tag } from '../domain/tag.js';
import { TagAlreadyExistsError } from '../domain/errors.js';
import type { TagDto } from './dto/tag.dto.js';

export class TagService {
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

  private toDto(tag: Tag): TagDto {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.toISOString(),
    };
  }
}
