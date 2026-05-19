import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { MetalsService } from './metals.service.js';
import type { CreateMetalDto } from './metals.types.js';

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

const QuerySchema = z.object({
  search: z.string().max(200).optional(),
  metal_type: z.enum(['gold', 'silver']).optional(),
  sort: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
});

export function createMetalsRouter(service: MetalsService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const params = QuerySchema.parse(req.query);
    const result = service.listAll({
      search: params.search,
      metal_type: params.metal_type,
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

  router.post('/', requireAuth, validateBody(MetalSchema), asyncHandler(async (req, res) => {
    const holding = service.create(req.body as CreateMetalDto);
    return created(res, holding);
  }));

  router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    return ok(res, service.getById(id));
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
