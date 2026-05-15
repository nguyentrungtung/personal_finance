import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { SavingsService } from './savings.service.js';

const SavingsSchema = z.object({
  institution_id: z.number().int().positive(),
  label: z.string().min(1).max(200),
  instrument_type: z.enum(['savings_account', 'certificate_of_deposit', 'money_market', 'treasury_bond']),
  principal: z.string().regex(/^\d+(\.\d{1,4})?$/),
  interest_rate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  start_date: z.string(),
  maturity_date: z.string(),
});

export function createSavingsRouter(service: SavingsService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (_req, res) => {
    const rows = service.listAll();
    return ok(res, rows, { count: rows.length });
  }));

  router.post('/', requireAuth, validateBody(SavingsSchema), asyncHandler(async (req, res) => {
    const instrument = service.create(req.body as z.infer<typeof SavingsSchema>);
    return created(res, instrument);
  }));

  router.put('/:id', requireAuth, validateBody(SavingsSchema.partial()), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const instrument = service.update(id, req.body as z.infer<ReturnType<typeof SavingsSchema.partial>>);
    return ok(res, instrument);
  }));

  router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = service.delete(id);
    return ok(res, result);
  }));

  return router;
}
