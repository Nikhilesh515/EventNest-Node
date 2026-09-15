import { describe, expect, it } from 'vitest';
import { Tag } from '../../../../src/modules/tags/domain/tag.js';
import { TagAlreadyExistsError } from '../../../../src/modules/tags/domain/errors.js';
import { ConflictError } from '../../../../src/shared/domain/errors.js';

describe('Tag Entity', () => {
  it('creates with correct props', () => {
    const tag = Tag.create('Technology', '#3b82f6');

    expect(tag.id).toBeDefined();
    expect(tag.name).toBe('Technology');
    expect(tag.color).toBe('#3b82f6');
    expect(tag.createdAt).toBeInstanceOf(Date);
    expect(tag.updatedAt).toBeInstanceOf(Date);
  });

  it('reconstitutes from props', () => {
    const now = new Date();
    const tag = Tag.reconstitute({
      id: 'test-id',
      name: 'Music',
      color: '#ef4444',
      createdAt: now,
      updatedAt: now,
    });

    expect(tag.id).toBe('test-id');
    expect(tag.name).toBe('Music');
    expect(tag.color).toBe('#ef4444');
  });

  it('updates name and bumps updatedAt', () => {
    const tag = Tag.create('Old Name', '#000000');
    const originalUpdatedAt = tag.updatedAt;

    tag.updateName('New Name');

    expect(tag.name).toBe('New Name');
    expect(tag.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
  });

  it('updates color and bumps updatedAt', () => {
    const tag = Tag.create('Tag', '#000000');
    const originalUpdatedAt = tag.updatedAt;

    tag.updateColor('#ffffff');

    expect(tag.color).toBe('#ffffff');
    expect(tag.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
  });
});

describe('TagAlreadyExistsError', () => {
  it('has statusCode 409', () => {
    const err = new TagAlreadyExistsError('Technology');
    expect(err.statusCode).toBe(409);
  });

  it('is instanceof ConflictError', () => {
    const err = new TagAlreadyExistsError('Technology');
    expect(err).toBeInstanceOf(ConflictError);
  });

  it('includes errors.name field', () => {
    const err = new TagAlreadyExistsError('Technology');
    expect(err.errors).toBeDefined();
    expect(err.errors!.name).toBeDefined();
    const nameErrors = err.errors!.name;
    expect(nameErrors?.[0]).toContain('Technology');
  });
});
