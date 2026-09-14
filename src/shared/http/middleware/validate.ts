import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../../domain/errors.js';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

const TARGETS = ['params', 'query', 'body'] as const;

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    const errors: Record<string, string[]> = {};

    for (const part of TARGETS) {
      const schema = schemas[part];
      if (!schema) {
        continue;
      }

      const parsed = schema.safeParse(req[part]);

      if (parsed.success) {
        if (part === 'query') {
          Object.defineProperty(req, 'query', {
            value: parsed.data,
            writable: true,
            configurable: true,
          });
        } else if (part === 'body') {
          req.body = parsed.data;
        } else {
          req.params = parsed.data as Record<string, string>;
        }
        continue;
      }

      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || part;
        (errors[key] ??= []).push(issue.message);
      }
    }

    if (Object.keys(errors).length > 0) {
      next(new ValidationError('Please check the highlighted fields.', errors));
      return;
    }

    next();
  };
}
