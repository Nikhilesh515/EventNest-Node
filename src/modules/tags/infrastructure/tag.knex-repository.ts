import type { Knex } from 'knex';
import type { TagRepository } from '../application/tag.repository.js';
import { Tag, type TagProps } from '../domain/tag.js';

function rowToProps(row: Record<string, unknown>): TagProps {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export class KnexTagRepository implements TagRepository {
  constructor(private readonly knex: Knex) {}

  async findById(id: string): Promise<Tag | null> {
    const row = await this.knex('tags').where({ id }).first();
    return row ? Tag.reconstitute(rowToProps(row)) : null;
  }

  async findByName(name: string): Promise<Tag | null> {
    const row = await this.knex('tags').where({ name }).first();
    return row ? Tag.reconstitute(rowToProps(row)) : null;
  }

  async create(tag: Tag): Promise<Tag> {
    const [row] = await this.knex('tags')
      .insert({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        created_at: tag.createdAt,
        updated_at: tag.updatedAt,
      })
      .returning('*');
    return Tag.reconstitute(rowToProps(row as Record<string, unknown>));
  }

  async update(tag: Tag): Promise<Tag> {
    const [row] = await this.knex('tags')
      .where({ id: tag.id })
      .update({
        name: tag.name,
        color: tag.color,
        updated_at: tag.updatedAt,
      })
      .returning('*');
    return Tag.reconstitute(rowToProps(row as Record<string, unknown>));
  }

  async delete(id: string): Promise<void> {
    await this.knex('tags').where({ id }).del();
  }

  async list(): Promise<Tag[]> {
    const rows = await this.knex('tags').select('*');
    return rows.map((row) => Tag.reconstitute(rowToProps(row as Record<string, unknown>)));
  }
}
