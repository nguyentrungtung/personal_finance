import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import { BusinessRuleError } from '../../shared/errors.js';
import type { LedgerService } from './ledger.service.js';

const CreateSchema = z.object({
  asset_class_id: z.number().int().positive(),
  institution_id: z.number().int().positive().optional(),
  entry_type: z.enum(['crypto_purchase', 'real_estate_appraisal', 'tax_transfer', 'savings_deposit', 'loan_repayment', 'other']),
  description: z.string().min(1).max(500),
  amount: z.string().regex(/^-?\d+(\.\d{1,4})?$/),
  status: z.enum(['completed', 'pending', 'appraisal', 'cleared']).default('completed'),
  transaction_date: z.string(),
  notes: z.string().max(1000).optional(),
});

const UpdateSchema = CreateSchema.partial();

const QuerySchema = z.object({
  asset_class: z.string().optional(),
  entry_type: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export function createLedgerRouter(service: LedgerService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const params = QuerySchema.parse(req.query);
    const result = service.listEntries({
      assetClass: params.asset_class,
      entryType: params.entry_type,
      dateFrom: params.date_from,
      dateTo: params.date_to,
      status: params.status,
      sort: params.sort,
      sortDir: params.sort_dir,
      page: params.page,
    });
    return ok(res, result.rows, { count: result.total_count, current_page: result.current_page });
  }));

  router.post('/', requireAuth, validateBody(CreateSchema), asyncHandler(async (req, res) => {
    const entry = service.createEntry(req.body as z.infer<typeof CreateSchema>);
    return created(res, entry);
  }));

  router.put('/:id', requireAuth, validateBody(UpdateSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const entry = service.updateEntry(id, req.body as z.infer<typeof UpdateSchema>);
    return ok(res, entry);
  }));

  router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const confirm = req.query.confirm;
    if (confirm !== 'true') {
      throw new BusinessRuleError('confirm=true query param required for delete', 'CONFIRM_REQUIRED');
    }
    const id = parseInt(req.params.id, 10);
    const result = service.softDeleteEntry(id);
    return ok(res, result);
  }));

  return router;
}
