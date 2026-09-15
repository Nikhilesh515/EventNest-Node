import { ConflictError } from '../../../shared/domain/errors.js';
import type { FieldErrors } from '../../../shared/domain/errors.js';

export class TagAlreadyExistsError extends ConflictError {
  constructor(name: string) {
    const errors: FieldErrors = { name: [`Tag '${name}' already exists.`] };
    super(`Tag '${name}' already exists.`, errors);
  }
}
