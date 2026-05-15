import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { CalendarService } from './calendar.service.js';

const EventSchema = z.object({
  title: z.string().min(1).max(300),
  event_type: z.enum(['maturity', 'debt_due', 'savings_goal', 'loan_settled', 'other']),
  due_date: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  asset_class_id: z.number().int().positive().optional(),
  linked_savings_id: z.number().int().positive().optional(),
  linked_loan_id: z.number().int().positive().optional(),
  linked_ledger_id: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
});

const QuerySchema = z.object({
  event_type: z.string().optional(),
  include_dismissed: z.coerce.boolean().default(false),
});

export function createCalendarRouter(service: CalendarService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const params = QuerySchema.parse(req.query);
    const rows = service.listEvents({
      eventType: params.event_type,
      includeDismissed: params.include_dismissed,
    });
    return ok(res, rows, { count: (rows as unknown[]).length });
  }));

  router.post('/', requireAuth, validateBody(EventSchema), asyncHandler(async (req, res) => {
    const event = service.createEvent(req.body as z.infer<typeof EventSchema>);
    return created(res, event);
  }));

  router.put('/:id', requireAuth, validateBody(EventSchema.partial()), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const event = service.updateEvent(id, req.body as z.infer<ReturnType<typeof EventSchema.partial>>);
    return ok(res, event);
  }));

  router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = service.deleteEvent(id);
    return ok(res, result);
  }));

  router.patch('/:id/dismiss', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const event = service.dismissEvent(id);
    return ok(res, event);
  }));

  return router;
}
