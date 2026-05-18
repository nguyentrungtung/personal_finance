import type Database from 'better-sqlite3';
import type { ScheduledJob, SmtpConfig, SmtpConfigRaw, UpdateJobDto, UpdateSmtpDto } from './scheduler.types.js';

export class SchedulerRepository {
  constructor(private readonly db: Database.Database) {}

  listJobs(): ScheduledJob[] {
    return (this.db.prepare('SELECT * FROM scheduled_jobs ORDER BY id ASC').all() as ScheduledJob[])
      .map(r => ({ ...r, enabled: Boolean(r.enabled) }));
  }

  getJob(id: number): ScheduledJob | undefined {
    const row = this.db.prepare('SELECT * FROM scheduled_jobs WHERE id = ?').get(id) as ScheduledJob | undefined;
    return row ? { ...row, enabled: Boolean(row.enabled) } : undefined;
  }

  updateJob(id: number, dto: UpdateJobDto): void {
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];
    if (dto.name !== undefined)            { sets.push('name = ?');            vals.push(dto.name); }
    if (dto.cron_expression !== undefined) { sets.push('cron_expression = ?'); vals.push(dto.cron_expression); }
    if (dto.enabled !== undefined)         { sets.push('enabled = ?');         vals.push(dto.enabled ? 1 : 0); }
    this.db.prepare(`UPDATE scheduled_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  }

  recordRun(id: number, status: 'ok' | 'error', log: string): void {
    this.db.prepare(`
      UPDATE scheduled_jobs
      SET last_run_at = datetime('now'), last_run_status = ?, last_run_log = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, log, id);
  }

  getSmtpConfig(): SmtpConfig {
    const row = this.db.prepare('SELECT * FROM smtp_config WHERE id = 1').get() as SmtpConfigRaw;
    return {
      ...row,
      secure: Boolean(row.secure),
      password: row.password ? '***' : null,
    };
  }

  getSmtpConfigRaw(): SmtpConfigRaw {
    return this.db.prepare('SELECT * FROM smtp_config WHERE id = 1').get() as SmtpConfigRaw;
  }

  updateSmtpConfig(dto: UpdateSmtpDto): SmtpConfig {
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];
    if (dto.provider   !== undefined) { sets.push('provider = ?');   vals.push(dto.provider); }
    if (dto.host       !== undefined) { sets.push('host = ?');       vals.push(dto.host); }
    if (dto.port       !== undefined) { sets.push('port = ?');       vals.push(dto.port); }
    if (dto.secure     !== undefined) { sets.push('secure = ?');     vals.push(dto.secure ? 1 : 0); }
    if (dto.user       !== undefined) { sets.push('user = ?');       vals.push(dto.user); }
    if (dto.from_name  !== undefined) { sets.push('from_name = ?');  vals.push(dto.from_name); }
    if (dto.from_email !== undefined) { sets.push('from_email = ?'); vals.push(dto.from_email); }
    // Only update password if a new non-masked value is provided
    if (dto.password !== undefined && dto.password !== '***') {
      sets.push('password = ?');
      vals.push(dto.password);
    }
    this.db.prepare(`UPDATE smtp_config SET ${sets.join(', ')} WHERE id = 1`).run(...vals);
    return this.getSmtpConfig();
  }
}
