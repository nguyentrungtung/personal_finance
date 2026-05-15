import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { InstitutionsService } from './institutions.service.js';

const InstitutionSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['bank', 'brokerage', 'crypto_exchange', 'other']),
  supported_channels: z.string().optional(), // JSON string array
});

export function createInstitutionsRouter(service: InstitutionsService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const includeArchived = req.query.include_archived === 'true';
    const assetClass = req.query.asset_class as string | undefined;
    const rows = service.listAll(includeArchived, assetClass);
    return ok(res, rows, { count: (rows as unknown[]).length });
  }));

  router.post('/', requireAuth, validateBody(InstitutionSchema), asyncHandler(async (req, res) => {
    const inst = service.create(req.body as z.infer<typeof InstitutionSchema>);
    return created(res, inst);
  }));

  router.put('/:id', requireAuth, validateBody(InstitutionSchema.partial()), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const inst = service.update(id, req.body as z.infer<ReturnType<typeof InstitutionSchema.partial>>);
    return ok(res, inst);
  }));

  router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = service.delete(id);
    return ok(res, result);
  }));

  router.post('/:id/archive', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const inst = service.archive(id);
    return ok(res, inst);
  }));

  router.post('/:id/restore', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const inst = service.restore(id);
    return ok(res, inst);
  }));

  return router;
}
