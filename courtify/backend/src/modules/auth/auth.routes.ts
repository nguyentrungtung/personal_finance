import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../infrastructure/middleware/asyncHandler.middleware.js';
import { validateBody } from '../../infrastructure/middleware/validateBody.middleware.js';
import { requireAuth } from '../../infrastructure/middleware/auth.middleware.js';
import { ok } from '../../shared/response.js';
import { AuthError } from '../../shared/errors.js';
import * as authService from './auth.service.js';
import type Database from 'better-sqlite3';

// ─── Login ─────────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const TotpVerifySchema = z.object({
  totp_token: z.string().min(1),
  code: z.string().length(6),
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
  confirm_password: z.string().min(1),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

const TotpEnableSchema = z.object({ code: z.string().length(6) });
const TotpDisableSchema = z.object({ password: z.string().min(1) });

const RecoverySchema = z.object({
  email: z.string().email(),
  recovery_code: z.string().min(1),
});

export function createAuthRouter(db: Database.Database): Router {
  const router = Router();

  router.post(
    '/login',
    validateBody(LoginSchema),
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as z.infer<typeof LoginSchema>;

      const result = await authService.login(db, email, password);

      if (result.requires_totp) {
        return ok(res, { authenticated: false, requires_totp: true, totp_token: result.totp_token });
      }

      const { accessToken, refreshToken } = authService.issueTokens(result.user.id, result.user.token_version);
      authService.setAuthCookies(res, accessToken, refreshToken);
      return ok(res, { authenticated: true, requires_totp: false });
    })
  );

  // ─── TOTP verify (complete 2FA login) ──────────────────────────────────────

  router.post(
    '/totp/verify',
    validateBody(TotpVerifySchema),
    asyncHandler(async (req, res) => {
      const { totp_token, code } = req.body as z.infer<typeof TotpVerifySchema>;

      const user = authService.verifyTotpLogin(db, totp_token, code);
      const { accessToken, refreshToken } = authService.issueTokens(user.id, user.token_version);
      authService.setAuthCookies(res, accessToken, refreshToken);
      return ok(res, { authenticated: true });
    })
  );

  // ─── Refresh ────────────────────────────────────────────────────────────────

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const refreshToken = req.cookies?.refresh_token as string | undefined;
      if (!refreshToken) throw new AuthError('Refresh token required');

      const { accessToken } = authService.refreshTokens(db, refreshToken);

      const isSecure = process.env.COOKIE_SECURE === 'true';
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      return ok(res, { refreshed: true });
    })
  );

  // ─── Logout ────────────────────────────────────────────────────────────────

  router.post('/logout', asyncHandler(async (_req, res) => {
    authService.clearAuthCookies(res);
    return ok(res, { logged_out: true });
  }));

  // ─── Me ────────────────────────────────────────────────────────────────────

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = authService.getUser(db, req.userId);
      const { password_hash: _ph, totp_secret: _ts, totp_recovery_codes: _rc, ...safeUser } = user;
      return ok(res, safeUser);
    })
  );

  // ─── Change password ───────────────────────────────────────────────────────

  router.put(
    '/password',
    requireAuth,
    validateBody(ChangePasswordSchema),
    asyncHandler(async (req, res) => {
      const { current_password, new_password } = req.body as z.infer<typeof ChangePasswordSchema>;
      await authService.changePassword(db, req.userId, current_password, new_password);
      return ok(res, { updated: true });
    })
  );

  // ─── 2FA Setup ─────────────────────────────────────────────────────────────

  router.post(
    '/2fa/setup',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await authService.setupTotp(db, req.userId);
      return ok(res, result);
    })
  );

  // ─── 2FA Enable ────────────────────────────────────────────────────────────

  router.post(
    '/2fa/enable',
    requireAuth,
    validateBody(TotpEnableSchema),
    asyncHandler(async (req, res) => {
      authService.enableTotp(db, req.userId, (req.body as z.infer<typeof TotpEnableSchema>).code);
      return ok(res, { totp_enabled: true });
    })
  );

  // ─── 2FA Disable ───────────────────────────────────────────────────────────

  router.post(
    '/2fa/disable',
    requireAuth,
    validateBody(TotpDisableSchema),
    asyncHandler(async (req, res) => {
      await authService.disableTotp(db, req.userId, (req.body as z.infer<typeof TotpDisableSchema>).password);
      return ok(res, { totp_enabled: false });
    })
  );

  // ─── 2FA Recovery ──────────────────────────────────────────────────────────

  router.post(
    '/2fa/recovery',
    validateBody(RecoverySchema),
    asyncHandler(async (req, res) => {
      const { email, recovery_code } = req.body as z.infer<typeof RecoverySchema>;
      const user = await authService.useRecoveryCode(db, email, recovery_code);
      const { accessToken, refreshToken } = authService.issueTokens(user.id, user.token_version);
      authService.setAuthCookies(res, accessToken, refreshToken);
      return ok(res, { authenticated: true, totp_enabled: false });
    })
  );

  return router;
}
