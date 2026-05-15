import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BusinessRuleError, NotFoundError, AuthError } from '../../shared/errors.js';

interface ErrorBody {
  error: string;
  code: string;
  details?: unknown;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProd = process.env.NODE_ENV === 'production';

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    } satisfies ErrorBody & { details: unknown });
    return;
  }

  if (err instanceof BusinessRuleError) {
    res.status(422).json({ error: err.message, code: err.code } satisfies ErrorBody);
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message, code: err.code } satisfies ErrorBody);
    return;
  }

  if (err instanceof AuthError) {
    res.status(401).json({ error: err.message, code: err.code } satisfies ErrorBody);
    return;
  }

  // Unhandled server error
  if (!isProd && err instanceof Error) {
    console.error('[Server Error]', err.stack);
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  } satisfies ErrorBody);
}
