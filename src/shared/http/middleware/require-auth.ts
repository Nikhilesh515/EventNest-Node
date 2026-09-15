import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../domain/errors.js';

interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  jti: string;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Authentication is required.'));
    return;
  }

  const token = header.slice(7);
  if (!token) {
    next(new UnauthorizedError('Authentication is required.'));
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    }) as AccessTokenPayload;

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      jti: payload.jti,
    };

    next();
  } catch {
    next(new UnauthorizedError('Authentication is required.'));
  }
};
