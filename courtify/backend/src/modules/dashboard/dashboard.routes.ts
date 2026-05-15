import { Router } from 'express';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { ok } from '../../shared/response.js';
import type { DashboardService } from './dashboard.service.js';

export function createDashboardRouter(service: DashboardService): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (_req, res) => {
      const data = service.getDashboardData();
      return ok(res, data);
    })
  );

  return router;
}
