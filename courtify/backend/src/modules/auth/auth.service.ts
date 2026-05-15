/**
 * authService — email/password + JWT (httpOnly cookies) + optional TOTP 2FA
 *
 * Lockout: 5 consecutive failures → locked_until = NOW + 15 min; reset on success.
 * token_version: incremented on password change; refresh tokens carry it for revocation.
 * TOTP: otplib; recovery codes bcrypt-hashed (8 codes, single-use).
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { AuthRepository } from './auth.repository.js';
import { AuthError, BusinessRuleError, NotFoundError } from '../../shared/errors.js';
import type { UserRow, AppJwtPayload } from './auth.types.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const JWT_REFRESH_EXPIRES_IN = '30d';
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

function signToken(payload: AppJwtPayload, expiresIn: string): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AppJwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as AppJwtPayload;
  } catch {
    throw new AuthError('Invalid or expired token');
  }
}

export function issueTokens(userId: number, tokenVersion: number) {
  const accessToken = signToken({ sub: userId, version: tokenVersion, type: 'access' }, JWT_EXPIRES_IN);
  const refreshToken = signToken({ sub: userId, version: tokenVersion, type: 'refresh' }, JWT_REFRESH_EXPIRES_IN);
  return { accessToken, refreshToken };
}

export function setAuthCookies(res: import('express').Response, accessToken: string, refreshToken: string): void {
  const isSecure = process.env.COOKIE_SECURE === 'true';
  const baseOpts = { httpOnly: true, sameSite: 'lax' as const, secure: isSecure };

  res.cookie('access_token', accessToken, {
    ...baseOpts,
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  res.cookie('refresh_token', refreshToken, {
    ...baseOpts,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth/refresh',
  });
}

export function clearAuthCookies(res: import('express').Response): void {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
}

/** login — verifies credentials, handles lockout, issues tokens or TOTP challenge */
export async function login(db: Database.Database, email: string, password: string): Promise<
  | { authenticated: true; requires_totp: false; user: UserRow }
  | { authenticated: false; requires_totp: true; totp_token: string }
> {
  const repo = new AuthRepository(db);
  const user = repo.findByEmail(email);

  if (!user) {
    throw new AuthError('Invalid email or password', 'UNAUTHORIZED');
  }

  // Check lockout
  if (user.locked_until) {
    const lockedUntil = new Date(user.locked_until);
    if (lockedUntil > new Date()) {
      throw new AuthError('Account locked due to too many failed attempts', 'ACCOUNT_LOCKED');
    }
    // Lock expired — reset
    repo.clearLockout(user.id);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    const attempts = user.failed_login_attempts + 1;
    if (attempts >= MAX_FAILURES) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      repo.lockAccount(user.id, attempts, lockedUntil);
      throw new AuthError('Account locked due to too many failed attempts', 'ACCOUNT_LOCKED');
    }
    repo.incrementFailedAttempts(user.id, attempts);
    throw new AuthError('Invalid email or password', 'UNAUTHORIZED');
  }

  // Success — reset failure counter
  repo.resetFailedAttempts(user.id);

  if (user.totp_enabled) {
    const totpToken = signToken({ sub: user.id, version: user.token_version, type: 'totp' }, '5m');
    return { authenticated: false, requires_totp: true, totp_token: totpToken };
  }

  return { authenticated: true, requires_totp: false, user };
}

/** verifyTotpLogin — validate totp_token + code, issue full session */
export function verifyTotpLogin(db: Database.Database, totpToken: string, code: string): UserRow {
  let payload: AppJwtPayload;
  try {
    payload = jwt.verify(totpToken, JWT_SECRET) as unknown as AppJwtPayload;
  } catch {
    throw new AuthError('Invalid or expired TOTP token');
  }

  if (payload.type !== 'totp') throw new AuthError('Invalid token type');

  const repo = new AuthRepository(db);
  const user = repo.findById(payload.sub);
  if (!user || !user.totp_secret || !user.totp_enabled) throw new AuthError('2FA not configured');

  const valid = authenticator.verify({ token: code, secret: user.totp_secret });
  if (!valid) throw new BusinessRuleError('TOTP code incorrect or expired', 'INVALID_TOTP');

  return user;
}

/** refreshTokens — validate refresh token, issue new access token */
export function refreshTokens(db: Database.Database, refreshToken: string): { accessToken: string; userId: number; tokenVersion: number } {
  let payload: AppJwtPayload;
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET) as unknown as AppJwtPayload;
  } catch {
    throw new AuthError('Invalid or expired refresh token');
  }

  if (payload.type !== 'refresh') throw new AuthError('Invalid token type');

  const repo = new AuthRepository(db);
  const user = repo.findTokenVersion(payload.sub);
  if (!user) throw new AuthError('User not found');

  if (payload.version !== user.token_version) {
    throw new AuthError('Session invalidated — please log in again');
  }

  const accessToken = signToken({ sub: payload.sub, version: user.token_version, type: 'access' }, JWT_EXPIRES_IN);
  return { accessToken, userId: payload.sub, tokenVersion: user.token_version };
}

/** setupTotp — generate secret + QR code + recovery codes */
export async function setupTotp(db: Database.Database, userId: number): Promise<{
  secret: string;
  qr_url: string;
  recovery_codes: string[];
}> {
  const repo = new AuthRepository(db);
  const user = repo.findTotpStatus(userId);
  if (!user) throw new NotFoundError('User');
  if (user.totp_enabled) throw new BusinessRuleError('2FA already enabled', 'FORBIDDEN');

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'COURTIFY', secret);
  const qr_url = await QRCode.toDataURL(otpauth);

  const recoveryCodes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    recoveryCodes.push(`${part1}-${part2}`);
  }

  const hashedCodes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
  repo.savePendingTotp(userId, secret, JSON.stringify(hashedCodes));

  return { secret, qr_url, recovery_codes: recoveryCodes };
}

/** enableTotp — verify setup code and activate 2FA */
export function enableTotp(db: Database.Database, userId: number, code: string): void {
  const repo = new AuthRepository(db);
  const user = repo.findTotpSecret(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.totp_secret) throw new BusinessRuleError('/2fa/setup was not called first', 'FORBIDDEN');
  if (user.totp_enabled) throw new BusinessRuleError('2FA already enabled', 'FORBIDDEN');

  const valid = authenticator.verify({ token: code, secret: user.totp_secret });
  if (!valid) throw new BusinessRuleError('TOTP code invalid or expired', 'INVALID_TOTP');

  repo.enableTotp(userId);
}

/** disableTotp — disable 2FA after password confirmation */
export async function disableTotp(db: Database.Database, userId: number, password: string): Promise<void> {
  const repo = new AuthRepository(db);
  const user = repo.findPasswordHash(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.totp_enabled) throw new BusinessRuleError('2FA is not enabled', 'FORBIDDEN');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new BusinessRuleError('Password incorrect');

  repo.disableTotp(userId);
}

/** useRecoveryCode — verify a recovery code, disable 2FA, issue full session */
export async function useRecoveryCode(db: Database.Database, email: string, recoveryCode: string): Promise<UserRow> {
  const repo = new AuthRepository(db);
  const user = repo.findByEmail(email);
  if (!user) throw new AuthError('Invalid email or recovery code');
  if (!user.totp_enabled) throw new BusinessRuleError('Account has no 2FA enabled');

  const storedCodes: string[] = JSON.parse(user.totp_recovery_codes || '[]') as string[];
  let matchedIndex = -1;

  for (let i = 0; i < storedCodes.length; i++) {
    const match = await bcrypt.compare(recoveryCode, storedCodes[i]);
    if (match) { matchedIndex = i; break; }
  }

  if (matchedIndex === -1) throw new AuthError('Invalid email or recovery code');

  storedCodes.splice(matchedIndex, 1);
  repo.disableTotpWithCodes(user.id, JSON.stringify(storedCodes));

  return user;
}

/** changePassword — verify current, re-hash new, increment token_version */
export async function changePassword(db: Database.Database, userId: number, currentPw: string, newPw: string): Promise<void> {
  const repo = new AuthRepository(db);
  const user = repo.findPasswordHashOnly(userId);
  if (!user) throw new NotFoundError('User');

  const valid = await bcrypt.compare(currentPw, user.password_hash);
  if (!valid) throw new BusinessRuleError('Current password is incorrect');

  const sameAsOld = await bcrypt.compare(newPw, user.password_hash);
  if (sameAsOld) throw new BusinessRuleError('New password must differ from current password');

  const newHash = await bcrypt.hash(newPw, BCRYPT_ROUNDS);
  repo.updatePassword(userId, newHash);
}

export function getUser(db: Database.Database, userId: number): UserRow {
  const repo = new AuthRepository(db);
  const user = repo.findById(userId);
  if (!user) throw new NotFoundError('User');
  return user;
}
