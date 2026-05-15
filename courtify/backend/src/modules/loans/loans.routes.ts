import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { LoansService } from './loans.service.js';

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
  sort: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
});

export function createLoansRouter(service: LoansService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const params = QuerySchema.parse(req.query);
    const rows = service.listAll({
      type: params.type,
      status: params.status,
      sort: params.sort,
      sortDir: params.sort_dir,
    });
    return ok(res, rows, { count: rows.length });
  }));

  router.post('/', requireAuth, validateBody(LoanSchema), asyncHandler(async (req, res) => {
    const loan = service.create(req.body as z.infer<typeof LoanSchema>);
    return created(res, loan);
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
    const payment = service.addPayment(id, req.body as z.infer<typeof PaymentSchema>);
    return created(res, payment);
  }));

  return router;
}
