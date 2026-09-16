import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../../../config/env.js';

export const REFRESH_COOKIE_NAME = 'eventnest.refresh_token';
export const REFRESH_COOKIE_PATH = '/api/auth';

function refreshCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
}

export function buildRefreshCookieOptions(config: AppConfig): CookieOptions {
  return {
    ...refreshCookieOptions(config),
    maxAge: config.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res: Response, token: string, config: AppConfig): void {
  res.cookie(REFRESH_COOKIE_NAME, token, buildRefreshCookieOptions(config));
}

export function clearRefreshCookie(res: Response, config: AppConfig): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(config));
}
