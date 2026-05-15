import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/client.js';
import { AuthError } from '../../shared/errors.js';
import { verifyToken } from '../../modules/auth/auth.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: number;
    }
  }
}

/**
 * JWT cookie verification middleware.
 * Reads the `access_token` httpOnly cookie, verifies signature and token_version.
 * Sets `req.userId` on success; returns 401 AuthError on any failure.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token as string | undefined;

  if (!token) {
    next(new AuthError('Access token required'));
    return;
  }

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    next(new AuthError('Invalid or expired access token'));
    return;
  }

  if (payload.type !== 'access') {
    next(new AuthError('Invalid token type'));
    return;
  }

  // Verify token_version (invalidated on password change)
  const db = getDb();
  const user = db.prepare<number>('SELECT token_version FROM users WHERE id = ?').get(payload.sub) as { token_version: number } | undefined;

  if (!user) {
    next(new AuthError('User not found'));
    return;
  }

  if (payload.version !== user.token_version) {
    next(new AuthError('Session invalidated — please log in again'));
    return;
  }

  req.userId = payload.sub;
  next();
}
