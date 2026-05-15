import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { MetalsService } from './metals.service.js';

const MetalSchema = z.object({
  metal_type: z.enum(['gold', 'silver']),
  label: z.string().max(200).optional(),
  weight_display: z.number().positive(),
  weight_unit: z.enum(['chi', 'luong', 'gram']),
  purity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  purchase_price_per_gram: z.string().regex(/^\d+(\.\d{1,4})?$/),
  current_price_per_gram: z.string().regex(/^\d+(\.\d{1,4})?$/),
  purchase_date: z.string(),
  institution_id: z.number().int().positive().optional(),
});

export function createMetalsRouter(service: MetalsService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (_req, res) => {
    const rows = service.listAll();
    return ok(res, rows, { count: rows.length });
  }));

  router.post('/', requireAuth, validateBody(MetalSchema), asyncHandler(async (req, res) => {
    const holding = service.create(req.body as z.infer<typeof MetalSchema>);
    return created(res, holding);
  }));

  router.put('/:id', requireAuth, validateBody(MetalSchema.partial()), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const holding = service.update(id, req.body as z.infer<ReturnType<typeof MetalSchema.partial>>);
    return ok(res, holding);
  }));

  router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = service.delete(id);
    return ok(res, result);
  }));

  return router;
}
