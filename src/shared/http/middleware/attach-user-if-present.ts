import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  jti: string;
}

export const attachUserIfPresent: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice(7);
  if (!token) {
    next();
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
  } catch {
    // Token invalid or missing — req.user stays undefined
  }

  next();
};
