import type { Response } from 'express';

interface ApiMeta {
  count?: number;
  [key: string]: unknown;
}

/** Send success envelope: { data, error: null, meta } */
export function ok<T>(res: Response, data: T, meta: ApiMeta = {}, status = 200): void {
  res.status(status).json({ data, error: null, meta });
}

/** Send created envelope (201) */
export function created<T>(res: Response, data: T, meta: ApiMeta = {}): void {
  ok(res, data, meta, 201);
}
