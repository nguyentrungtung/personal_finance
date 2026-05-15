import type Database from 'better-sqlite3';

export class SettingsRepository {
  constructor(private readonly db: Database.Database) {}

  findOne() {
    return this.db.prepare('SELECT * FROM settings WHERE id = 1').get();
  }

  update(sets: string[], vals: (string | number | null)[]) {
    this.db.prepare(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`).run(...vals);
    return this.findOne();
  }

  getProfile(userId: number) {
    return this.db.prepare(
      'SELECT id, email, full_name, professional_title, avatar_path FROM users WHERE id = ?'
    ).get(userId) as Record<string, unknown> | null;
  }

  updateProfile(userId: number, sets: string[], vals: (string | number | null)[]) {
    this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, userId);
    return this.getProfile(userId);
  }

  updateAvatar(userId: number, avatarPath: string) {
    this.db.prepare("UPDATE users SET avatar_path = ?, updated_at = datetime('now') WHERE id = ?")
      .run(avatarPath, userId);
  }
}
