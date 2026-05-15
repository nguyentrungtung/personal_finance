import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import multer from 'multer';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { ok } from '../../shared/response.js';
import type { SettingsService } from './settings.service.js';

const UPLOAD_PATH = process.env.UPLOAD_PATH ?? path.join(process.cwd(), 'uploads');
const avatarStorage = multer.diskStorage({
  destination: path.join(UPLOAD_PATH, 'avatars'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const SettingsSchema = z.object({
  notification_days_advance: z.string().optional(), // JSON array string
  notification_emails: z.string().optional(),       // JSON array of email strings
  timezone: z.string().optional(),
  currency: z.string().optional(),
  asset_subtypes_config: z.string().optional(), // JSON string
  country_code: z.string().max(2).nullable().optional(),
  date_format: z.string().max(20).optional(),
});

const ProfileSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  professional_title: z.string().max(200).optional(),
});

export function createSettingsRouter(service: SettingsService): Router {
  const router = Router();

  // ─── Settings ────────────────────────────────────────────────────────────────

  router.get('/', requireAuth, asyncHandler(async (_req, res) => {
    const row = service.getSettings();
    return ok(res, row);
  }));

  router.put('/', requireAuth, validateBody(SettingsSchema), asyncHandler(async (req, res) => {
    const row = service.updateSettings(req.body as z.infer<typeof SettingsSchema>);
    return ok(res, row);
  }));

  // ─── Profile ─────────────────────────────────────────────────────────────────

  router.get('/profile', requireAuth, asyncHandler(async (req, res) => {
    const user = service.getProfile(req.userId);
    return ok(res, user);
  }));

  router.put('/profile', requireAuth, validateBody(ProfileSchema), asyncHandler(async (req, res) => {
    const user = service.updateProfile(req.userId, req.body as z.infer<typeof ProfileSchema>);
    return ok(res, user);
  }));

  router.post('/avatar', requireAuth, upload.single('avatar'), asyncHandler(async (req, res) => {
    if (!req.file) {
      return ok(res, { avatar_path: null });
    }
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const result = service.updateAvatar(req.userId, avatarPath);
    return ok(res, result);
  }));

  return router;
}
