import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok } from '../../shared/response.js';
import type { SchedulerService } from './scheduler.service.js';

const UpdateJobSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  cron_expression: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

const UpdateSmtpSchema = z.object({
  provider: z.enum(['gmail', 'custom']).optional(),
  host: z.string().nullable().optional(),
  port: z.number().int().positive().nullable().optional(),
  secure: z.boolean().optional(),
  user: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  from_name: z.string().max(200).optional(),
  from_email: z.string().email().nullable().optional(),
});

const TestSmtpSchema = z.object({
  to: z.string().email(),
});

export function createSchedulerRouter(service: SchedulerService): Router {
  const router = Router();

  // ─── Jobs ─────────────────────────────────────────────────────────────────
  router.get('/jobs', requireAuth, asyncHandler(async (_req, res) => {
    const jobs = service.listJobs();
    return ok(res, jobs, { count: jobs.length });
  }));

  router.put('/jobs/:id', requireAuth, validateBody(UpdateJobSchema), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const job = await service.updateJob(id, req.body as z.infer<typeof UpdateJobSchema>);
    return ok(res, job);
  }));

  router.post('/jobs/:id/run', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await service.runJobNow(id);
    return ok(res, result);
  }));

  // ─── SMTP ─────────────────────────────────────────────────────────────────
  router.get('/smtp', requireAuth, asyncHandler(async (_req, res) => {
    const cfg = service.getSmtpConfig();
    return ok(res, cfg);
  }));

  router.put('/smtp', requireAuth, validateBody(UpdateSmtpSchema), asyncHandler(async (req, res) => {
    const cfg = service.updateSmtpConfig(req.body as z.infer<typeof UpdateSmtpSchema>);
    return ok(res, cfg);
  }));

  router.post('/smtp/test', requireAuth, validateBody(TestSmtpSchema), asyncHandler(async (req, res) => {
    const result = await service.testSmtp((req.body as z.infer<typeof TestSmtpSchema>).to);
    return ok(res, result);
  }));

  return router;
}
