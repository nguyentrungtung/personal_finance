import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import { BusinessRuleError } from '../../shared/errors.js';
import type { LedgerService } from './ledger.service.js';

// All valid entry types — keep in sync with frontend ENTRY_TYPES_BY_CLASS
const ENTRY_TYPE_VALUES = [
  'crypto_purchase', 'crypto_sale', 'stock_purchase', 'stock_sale', 'dividend',
  'metal_purchase', 'metal_sale', 'metal_appraisal',
  'real_estate_purchase', 'real_estate_appraisal', 'rental_income',
  'savings_deposit', 'savings_withdrawal', 'interest_income',
  'tax_transfer', 'loan_repayment', 'other',
] as const;

const STATUS_VALUES = ['completed', 'pending', 'appraisal', 'cleared', 'reversed'] as const;

const CreateSchema = z.object({
  asset_class_id: z.number().int().positive(),
  institution_id: z.number().int().positive().optional(),
  entry_type: z.enum(ENTRY_TYPE_VALUES),
  description: z.string().min(1).max(500),
  amount: z.string().regex(/^-?\d+(\.\d{1,4})?$/),
  status: z.enum(STATUS_VALUES).default('completed'),
  transaction_date: z.string(),
  notes: z.string().max(1000).optional(),
});

const UpdateSchema = CreateSchema.partial().extend({
  edit_reason: z.string().max(500).optional(),
});

// PATCH /:id/status — lightweight single-field update
const PatchStatusSchema = z.object({
  status: z.enum(STATUS_VALUES),
});

// PATCH /:id/void — void an entry with mandatory reason
const VoidSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
});

// POST /:id/reverse — create a reversal entry (negates the original)
const ReverseSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
});

// PATCH /bulk-status — update status for multiple entries at once
const BulkStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  status: z.enum(STATUS_VALUES),
});

const QuerySchema = z.object({
  asset_class: z.string().optional(),
  entry_type: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.string().optional(),
  search: z.string().max(200).optional(),
  include_voided: z.coerce.boolean().default(false),
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
      search: params.search,
      includeVoided: params.include_voided,
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

  router.post('/', requireAuth, validateBody(CreateSchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof CreateSchema>;
    const entry = service.createEntry({
      asset_class_id: body.asset_class_id,
      institution_id: body.institution_id,
      entry_type: body.entry_type,
      description: body.description,
      amount: body.amount,
      status: body.status,
      transaction_date: body.transaction_date,
      notes: body.notes,
    });
    return created(res, entry);
  }));

  router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    return ok(res, service.getEntryById(id));
  }));

  router.put('/:id', requireAuth, validateBody(UpdateSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const body = req.body as z.infer<typeof UpdateSchema>;
    const entry = service.updateEntry(id, body);
    return ok(res, entry);
  }));

  // Lightweight status-only update — avoids sending full payload for a single field change
  router.patch('/:id/status', requireAuth, validateBody(PatchStatusSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as z.infer<typeof PatchStatusSchema>;
    const entry = service.updateStatus(id, status);
    return ok(res, entry);
  }));

  // Void an entry — accounting-correct way to handle errors instead of deleting
  router.patch('/:id/void', requireAuth, validateBody(VoidSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as z.infer<typeof VoidSchema>;
    const entry = service.voidEntry(id, reason);
    return ok(res, entry);
  }));

  // Bulk status update — update up to 500 entries in one request
  router.patch('/bulk-status', requireAuth, validateBody(BulkStatusSchema), asyncHandler(async (req, res) => {
    const { ids, status } = req.body as z.infer<typeof BulkStatusSchema>;
    const result = service.bulkUpdateStatus(ids, status);
    return ok(res, result);
  }));

  // Create a reversal entry — the accounting-correct way to undo a completed entry
  router.post('/:id/reverse', requireAuth, validateBody(ReverseSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as z.infer<typeof ReverseSchema>;
    const reversal = service.reverseEntry(id, reason);
    return created(res, reversal);
  }));

  // Get edit history (versions) for an entry
  router.get('/:id/versions', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const versions = service.getEntryVersions(id);
    return ok(res, versions);
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
