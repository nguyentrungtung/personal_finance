import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Middleware factory — validates req.body against the given Zod schema.
 * On success: replaces req.body with the parsed/coerced value.
 * On failure: calls next(ZodError) which the global errorHandler maps to 400.
 */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data as typeof req.body;
    next();
  };
}
