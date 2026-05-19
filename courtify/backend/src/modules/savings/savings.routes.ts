import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { SavingsService } from './savings.service.js';
import type { CreateSavingsDto } from './savings.types.js';

const SavingsSchema = z.object({
  institution_id: z.number().int().positive(),
  label: z.string().min(1).max(200),
  instrument_type: z.enum(['savings_account', 'certificate_of_deposit', 'money_market', 'treasury_bond']),
  principal: z.string().regex(/^\d+(\.\d{1,4})?$/),
  interest_rate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  start_date: z.string(),
  maturity_date: z.string(),
});

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  instrument_type: z.string().optional(),
  sort: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
});

export function createSavingsRouter(service: SavingsService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const params = QuerySchema.parse(req.query);
    const result = service.listAll({
      search: params.search,
      status: params.status,
      instrument_type: params.instrument_type,
      sort: params.sort,
      sortDir: params.sort_dir,
      page: params.page,
    });
    return ok(res, result.rows, {
      count: result.total_count,
      current_page: result.current_page,
      total_pages: result.total_pages,
      per_page: result.per_page,
    });
  }));

  router.post('/', requireAuth, validateBody(SavingsSchema), asyncHandler(async (req, res) => {
    const instrument = service.create(req.body as CreateSavingsDto);
    return created(res, instrument);
  }));

  router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    return ok(res, service.getById(id));
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
