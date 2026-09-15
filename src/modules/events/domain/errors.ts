import { ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import type { FieldErrors } from '../../../shared/domain/errors.js';

export class DuplicateEventTitleError extends ConflictError {
  constructor(title: string) {
    const errors: FieldErrors = { title: [`Event with title '${title}' already exists.`] };
    super(`Event with title '${title}' already exists.`, errors);
  }
}

export class InvalidTagError extends ValidationError {
  constructor(unknownIds: string[]) {
    const errors: FieldErrors = { tags: [`Unknown tag IDs: ${unknownIds.join(', ')}`] };
    super('One or more tag IDs are invalid.', errors);
  }
}
