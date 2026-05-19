import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { LoansService } from './loans.service.js';
import type { CreateLoanDto } from './loans.types.js';

const LoanSchema = z.object({
  loan_type: z.enum(['lent', 'borrowed']),
  counterparty_name: z.string().min(1).max(200),
  principal: z.string().regex(/^\d+(\.\d{1,4})?$/),
  date_issued: z.string(),
  expected_due_date: z.string(),
  repayment_terms: z.string().max(1000).optional(),
  description: z.string().max(500).optional(),
  interest_rate: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  interest_type: z.enum(['percentage', 'fixed']).optional(),
});

const PaymentSchema = z.object({
  paid_amount: z.string().regex(/^\d+(\.\d{1,4})?$/),
  due_date: z.string(),
  notes: z.string().max(500).optional(),
});

const QuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().max(200).optional(),
  sort: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
});

export function createLoansRouter(service: LoansService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const params = QuerySchema.parse(req.query);
    const result = service.listAll({
      type: params.type,
      status: params.status,
      search: params.search,
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

  router.post('/', requireAuth, validateBody(LoanSchema), asyncHandler(async (req, res) => {
    const loan = service.create(req.body as CreateLoanDto);
    return created(res, loan);
  }));

  router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    return ok(res, service.getById(id));
  }));

  router.put('/:id', requireAuth, validateBody(LoanSchema.partial()), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const loan = service.update(id, req.body as z.infer<ReturnType<typeof LoanSchema.partial>>);
    return ok(res, loan);
  }));

  router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const force = req.query.force === 'true';
    const result = service.delete(id, force);
    return ok(res, result);
  }));

  router.get('/:id/payments', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const payments = service.listPayments(id);
    return ok(res, payments, { count: (payments as unknown[]).length });
  }));

  router.post('/:id/payments', requireAuth, validateBody(PaymentSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const payment = service.addPayment(id, req.body as { paid_amount: string; due_date: string; notes?: string });
    return created(res, payment);
  }));

  return router;
}
