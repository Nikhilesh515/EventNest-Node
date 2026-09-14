import type { Response } from 'express';
import type { FieldErrors } from '../domain/errors.js';

export interface Envelope<T> {
  code: number;
  success: boolean;
  message: string | null;
  result: T | null;
  errors: FieldErrors | null;
}

export function ok<T>(res: Response, result: T, message: string | null = null): Envelope<T> {
  const body: Envelope<T> = { code: 200, success: true, message, result, errors: null };
  res.status(200).json(body);
  return body;
}

export function created<T>(res: Response, result: T, location: string): Envelope<T> {
  const body: Envelope<T> = { code: 201, success: true, message: null, result, errors: null };
  res.status(201).location(location).json(body);
  return body;
}

export function noContent(res: Response): void {
  res.status(204).end();
}

export function fail(
  res: Response,
  code: number,
  message: string,
  errors: FieldErrors | null = null,
): Envelope<null> {
  const body: Envelope<null> = { code, success: false, message, result: null, errors };
  res.status(code).json(body);
  return body;
}
