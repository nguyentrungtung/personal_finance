/**
 * Unit tests for authService — uses in-memory SQLite.
 * TDD: written alongside service implementation (Constitution II).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import * as authService from '../../src/services/authService.js';
import { AuthError, BusinessRuleError } from '../../src/errors.js';

// ── In-memory DB setup ────────────────────────────────────────────────────────

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      professional_title TEXT,
      avatar_path TEXT,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      totp_recovery_codes TEXT DEFAULT '[]',
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

async function createUser(db: Database.Database, overrides: Partial<{
  email: string;
  password: string;
  totp_enabled: number;
  totp_secret: string;
  token_version: number;
  failed_login_attempts: number;
  locked_until: string | null;
}> = {}): Promise<number> {
  const hash = await bcrypt.hash(overrides.password ?? 'TestPass123!', 10);
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, totp_enabled, totp_secret, token_version, failed_login_attempts, locked_until)
    VALUES (?, ?, 'Test User', ?, ?, ?, ?, ?)
  `).run(
    overrides.email ?? 'test@example.com',
    hash,
    overrides.totp_enabled ?? 0,
    overrides.totp_secret ?? null,
    overrides.token_version ?? 0,
    overrides.failed_login_attempts ?? 0,
    overrides.locked_until ?? null
  );
  return result.lastInsertRowid as number;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authService.login', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns authenticated:true on correct credentials', async () => {
    await createUser(db);
    const result = await authService.login(db, 'test@example.com', 'TestPass123!');
    expect(result.authenticated).toBe(true);
    expect(result.requires_totp).toBe(false);
  });

  it('throws UNAUTHORIZED on wrong password', async () => {
    await createUser(db);
    await expect(authService.login(db, 'test@example.com', 'wrong')).rejects.toThrow(AuthError);
  });

  it('throws UNAUTHORIZED for unknown email', async () => {
    await expect(authService.login(db, 'nobody@example.com', 'pw')).rejects.toThrow(AuthError);
  });

  it('increments failed_login_attempts on wrong password', async () => {
    await createUser(db);
    try { await authService.login(db, 'test@example.com', 'wrong'); } catch { /* expected */ }
    const user = db.prepare("SELECT failed_login_attempts FROM users WHERE email='test@example.com'").get() as { failed_login_attempts: number };
    expect(user.failed_login_attempts).toBe(1);
  });

  it('locks account after 5 consecutive failures', async () => {
    await createUser(db, { failed_login_attempts: 4 });
    await expect(authService.login(db, 'test@example.com', 'wrong')).rejects.toThrow(AuthError);
    const user = db.prepare("SELECT locked_until FROM users WHERE email='test@example.com'").get() as { locked_until: string };
    expect(user.locked_until).toBeTruthy();
  });

  it('rejects login when account is locked', async () => {
    const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await createUser(db, { locked_until: futureTime, failed_login_attempts: 5 });
    await expect(authService.login(db, 'test@example.com', 'TestPass123!')).rejects.toThrow(AuthError);
  });

  it('resets failures on successful login', async () => {
    await createUser(db, { failed_login_attempts: 3 });
    await authService.login(db, 'test@example.com', 'TestPass123!');
    const user = db.prepare("SELECT failed_login_attempts FROM users WHERE email='test@example.com'").get() as { failed_login_attempts: number };
    expect(user.failed_login_attempts).toBe(0);
  });

  it('returns requires_totp:true when 2FA enabled', async () => {
    const { authenticator } = await import('otplib');
    const secret = authenticator.generateSecret();
    await createUser(db, { totp_enabled: 1, totp_secret: secret });
    const result = await authService.login(db, 'test@example.com', 'TestPass123!');
    expect(result.requires_totp).toBe(true);
    if (result.requires_totp) {
      expect(result.totp_token).toBeTruthy();
    }
  });
});

describe('authService.issueTokens', () => {
  it('returns accessToken and refreshToken strings', () => {
    const { accessToken, refreshToken } = authService.issueTokens(1, 0);
    expect(typeof accessToken).toBe('string');
    expect(typeof refreshToken).toBe('string');
    expect(accessToken.split('.').length).toBe(3); // JWT format
  });
});

describe('authService.refreshTokens', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('issues new access token from valid refresh token', async () => {
    const id = await createUser(db);
    const { refreshToken } = authService.issueTokens(id, 0);
    const result = authService.refreshTokens(db, refreshToken);
    expect(result.accessToken).toBeTruthy();
    expect(result.userId).toBe(id);
  });

  it('throws AuthError when token_version mismatches', async () => {
    const id = await createUser(db, { token_version: 0 });
    const { refreshToken } = authService.issueTokens(id, 0);
    // Increment token_version (simulate password change)
    db.prepare('UPDATE users SET token_version = 1 WHERE id = ?').run(id);
    expect(() => authService.refreshTokens(db, refreshToken)).toThrow(AuthError);
  });
});

describe('authService.changePassword', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('increments token_version on success', async () => {
    const id = await createUser(db);
    await authService.changePassword(db, id, 'TestPass123!', 'NewPass456!');
    const user = db.prepare<number>('SELECT token_version FROM users WHERE id = ?').get(id) as { token_version: number };
    expect(user.token_version).toBe(1);
  });

  it('throws on incorrect current password', async () => {
    const id = await createUser(db);
    await expect(authService.changePassword(db, id, 'wrong', 'NewPass456!')).rejects.toThrow(BusinessRuleError);
  });

  it('throws when new password same as current', async () => {
    const id = await createUser(db);
    await expect(authService.changePassword(db, id, 'TestPass123!', 'TestPass123!')).rejects.toThrow(BusinessRuleError);
  });
});

describe('authService.setupTotp', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('returns secret, qr_url, and 8 recovery codes', async () => {
    const id = await createUser(db);
    const result = await authService.setupTotp(db, id);
    expect(result.secret).toBeTruthy();
    expect(result.qr_url).toMatch(/^data:image\/png;base64,/);
    expect(result.recovery_codes).toHaveLength(8);
  });

  it('stores bcrypt-hashed recovery codes in DB', async () => {
    const id = await createUser(db);
    const { recovery_codes } = await authService.setupTotp(db, id);
    const user = db.prepare<number>('SELECT totp_recovery_codes FROM users WHERE id = ?').get(id) as { totp_recovery_codes: string };
    const storedCodes: string[] = JSON.parse(user.totp_recovery_codes) as string[];
    expect(storedCodes).toHaveLength(8);
    // Verify first code is hashed (bcrypt hash starts with $2b$)
    expect(storedCodes[0]).toMatch(/^\$2[ab]\$/);
    // Verify it's the hash of the plaintext code
    const isMatch = await bcrypt.compare(recovery_codes[0], storedCodes[0]);
    expect(isMatch).toBe(true);
  });

  it('throws FORBIDDEN if 2FA already enabled', async () => {
    const id = await createUser(db, { totp_enabled: 1 });
    await expect(authService.setupTotp(db, id)).rejects.toThrow(BusinessRuleError);
  });
});

describe('authService.useRecoveryCode', () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  it('disables 2FA and removes used code', async () => {
    const id = await createUser(db);
    const { recovery_codes } = await authService.setupTotp(db, id);
    // Manually enable 2FA
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(id);

    await authService.useRecoveryCode(db, 'test@example.com', recovery_codes[0]);

    const user = db.prepare<number>('SELECT totp_enabled, totp_recovery_codes FROM users WHERE id = ?').get(id) as { totp_enabled: number; totp_recovery_codes: string };
    expect(user.totp_enabled).toBe(0);
    const remaining: string[] = JSON.parse(user.totp_recovery_codes) as string[];
    expect(remaining).toHaveLength(7); // 8 - 1
  });

  it('throws AuthError for invalid recovery code', async () => {
    const id = await createUser(db);
    await authService.setupTotp(db, id);
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(id);
    await expect(authService.useRecoveryCode(db, 'test@example.com', 'ZZZZ-9999')).rejects.toThrow(AuthError);
  });
});
