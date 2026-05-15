import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok, created } from '../../shared/response.js';
import type { InvestmentService } from './investment.service.js';

const BuySchema = z.object({
  asset_class_id: z.number().int().positive(),
  asset_name: z.string().min(1).max(200),
  asset_subtype: z.enum(['stock', 'crypto', 'mutual_fund', 'etf', 'gold', 'silver', 'real_estate', 'other']),
  institution_id: z.number().int().positive().optional(),
  purchase_date: z.string(),
  volume: z.string().regex(/^\d+(\.\d{1,4})?$/),
  buy_price_per_unit: z.string().regex(/^\d+(\.\d{1,4})?$/),
  current_price_per_unit: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unit_label: z.string().max(50).optional(),
  fee: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  notes: z.string().max(500).optional(),
});

const SellSchema = z.object({
  asset_name: z.string().min(1),
  asset_class_id: z.number().int().positive().optional(),
  sell_volume: z.number().positive(),
  sell_price: z.number().positive(),
  fee: z.number().min(0).optional(),
  date: z.string(),
});

const PriceUpdateSchema = z.object({
  current_price_per_unit: z.string().regex(/^\d+(\.\d{1,4})?$/),
});

const QuerySchema = z.object({
  asset_class: z.string().optional(),
  subtype: z.string().optional(),
  view: z.enum(['lot', 'aggregated']).default('lot'),
});

const HistoryQuerySchema = z.object({
  asset_class: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export function createInvestmentRouter(service: InvestmentService): Router {
  const router = Router();

  router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const params = QuerySchema.parse(req.query);
    const rows = service.listLots({
      assetClass: params.asset_class,
      subtype: params.subtype,
      view: params.view,
    });
    return ok(res, rows, { count: (rows as unknown[]).length });
  }));

  router.post('/', requireAuth, validateBody(BuySchema), asyncHandler(async (req, res) => {
    const lot = service.buyLot(req.body as z.infer<typeof BuySchema>);
    return created(res, lot);
  }));

  router.post('/sell', requireAuth, validateBody(SellSchema), asyncHandler(async (req, res) => {
    const result = service.sellLot(req.body as z.infer<typeof SellSchema>);
    return ok(res, result);
  }));

  router.patch('/:id/price', requireAuth, validateBody(PriceUpdateSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const lot = service.updateLotPrice(id, (req.body as z.infer<typeof PriceUpdateSchema>).current_price_per_unit);
    return ok(res, lot);
  }));

  router.get('/history', requireAuth, asyncHandler(async (req, res) => {
    const params = HistoryQuerySchema.parse(req.query);
    const rows = service.listTradeHistory({
      assetClass: params.asset_class,
      dateFrom: params.date_from,
      dateTo: params.date_to,
    });
    return ok(res, rows, { count: (rows as unknown[]).length });
  }));

  return router;
}
