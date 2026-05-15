import type Database from 'better-sqlite3';
import type { UserRow } from './auth.types.js';

export class AuthRepository {
  constructor(private readonly db: Database.Database) {}

  findByEmail(email: string): UserRow | undefined {
    return this.db.prepare<string>('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  }

  findById(id: number): UserRow | undefined {
    return this.db.prepare<number>('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  findTokenVersion(id: number): { token_version: number } | undefined {
    return this.db.prepare<number>('SELECT token_version FROM users WHERE id = ?').get(id) as { token_version: number } | undefined;
  }

  findTotpStatus(id: number): { email: string; totp_enabled: number } | undefined {
    return this.db.prepare<number>('SELECT email, totp_enabled FROM users WHERE id = ?').get(id) as { email: string; totp_enabled: number } | undefined;
  }

  findTotpSecret(id: number): { totp_secret: string | null; totp_enabled: number } | undefined {
    return this.db.prepare<number>('SELECT totp_secret, totp_enabled FROM users WHERE id = ?').get(id) as { totp_secret: string | null; totp_enabled: number } | undefined;
  }

  findPasswordHash(id: number): { password_hash: string; totp_enabled: number } | undefined {
    return this.db.prepare<number>('SELECT password_hash, totp_enabled FROM users WHERE id = ?').get(id) as { password_hash: string; totp_enabled: number } | undefined;
  }

  findPasswordHashOnly(id: number): { password_hash: string } | undefined {
    return this.db.prepare<number>('SELECT password_hash FROM users WHERE id = ?').get(id) as { password_hash: string } | undefined;
  }

  clearLockout(id: number): void {
    this.db.prepare("UPDATE users SET locked_until = NULL, failed_login_attempts = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  }

  incrementFailedAttempts(id: number, attempts: number): void {
    this.db.prepare("UPDATE users SET failed_login_attempts = ?, updated_at = datetime('now') WHERE id = ?").run(attempts, id);
  }

  lockAccount(id: number, attempts: number, lockedUntil: string): void {
    this.db.prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?").run(attempts, lockedUntil, id);
  }

  resetFailedAttempts(id: number): void {
    this.db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
  }

  savePendingTotp(id: number, secret: string, hashedCodes: string): void {
    this.db.prepare("UPDATE users SET totp_secret = ?, totp_recovery_codes = ?, updated_at = datetime('now') WHERE id = ?").run(secret, hashedCodes, id);
  }

  enableTotp(id: number): void {
    this.db.prepare("UPDATE users SET totp_enabled = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  }

  disableTotp(id: number): void {
    this.db.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_codes = '[]', updated_at = datetime('now') WHERE id = ?").run(id);
  }

  disableTotpWithCodes(id: number, hashedCodes: string): void {
    this.db.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_codes = ?, updated_at = datetime('now') WHERE id = ?").run(hashedCodes, id);
  }

  updatePassword(id: number, newHash: string): void {
    this.db.prepare("UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?").run(newHash, id);
  }
}
