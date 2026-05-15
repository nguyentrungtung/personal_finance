import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { ok } from '../../shared/response.js';
import type { AnalyticsService } from './analytics.service.js';

const RangeSchema = z.object({
  range: z.enum(['3M', '6M', '1Y', 'all']).default('1Y'),
});

const PnlQuerySchema = z.object({
  asset_class: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export function createAnalyticsRouter(service: AnalyticsService): Router {
  const router = Router();

  router.get('/net-worth', requireAuth, asyncHandler(async (req, res) => {
    const { range } = RangeSchema.parse(req.query);
    const rows = service.getNetWorthHistory(range);
    return ok(res, rows, { count: (rows as unknown[]).length });
  }));

  router.get('/performance', requireAuth, asyncHandler(async (req, res) => {
    const { range } = RangeSchema.parse(req.query);
    const rows = service.getAssetClassPerformance(range);
    return ok(res, rows, { count: (rows as unknown[]).length });
  }));

  router.get('/projection', requireAuth, asyncHandler(async (req, res) => {
    const { range } = RangeSchema.parse(req.query);
    const projections = service.getProjection(range);
    return ok(res, projections, { count: projections.length });
  }));

  router.get('/pnl', requireAuth, asyncHandler(async (req, res) => {
    const params = PnlQuerySchema.parse(req.query);
    const result = service.getRealizedPnl({
      assetClass: params.asset_class,
      dateFrom: params.date_from,
      dateTo: params.date_to,
    });
    return ok(res, result);
  }));

  return router;
}
