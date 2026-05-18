import type Database from 'better-sqlite3';

export async function runDataCleanupJob(db: Database.Database): Promise<string> {
  const logs: string[] = [];

  // Delete dismissed calendar events older than 90 days
  const calResult = db.prepare(`
    DELETE FROM calendar_events
    WHERE is_dismissed = 1
      AND updated_at < datetime('now', '-90 days')
  `).run();
  logs.push(`Deleted ${calResult.changes} dismissed calendar events (>90 days old)`);

  // Trim scheduled_jobs last_run_log to avoid bloat
  db.prepare(`
    UPDATE scheduled_jobs
    SET last_run_log = substr(last_run_log, -2000)
    WHERE length(last_run_log) > 2000
  `).run();
  logs.push('Trimmed oversized job logs');

  return logs.join('; ');
}
