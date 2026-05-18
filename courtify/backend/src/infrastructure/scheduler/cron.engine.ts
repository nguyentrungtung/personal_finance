import cron from 'node-cron';
import type Database from 'better-sqlite3';
import { EmailService } from './email.service.js';
import { runCalendarReminderJob } from './jobs/calendar-reminder.job.js';
import { runDataCleanupJob } from './jobs/data-cleanup.job.js';
import { runNightlySummaryJob } from './jobs/nightly-summary.job.js';

type JobType = 'calendar_reminder' | 'data_cleanup' | 'nightly_summary';

interface JobRow {
  id: number;
  job_type: JobType;
  cron_expression: string;
  enabled: number;
}

export class CronEngine {
  private tasks = new Map<number, cron.ScheduledTask>();
  private db!: Database.Database;
  private email = new EmailService();

  start(db: Database.Database): void {
    this.db = db;
    this.reloadAll();
    console.warn('[scheduler] CronEngine started');
  }

  reloadAll(): void {
    // Stop all existing tasks
    for (const task of this.tasks.values()) task.stop();
    this.tasks.clear();

    const jobs = this.db.prepare('SELECT * FROM scheduled_jobs WHERE enabled = 1').all() as JobRow[];
    for (const job of jobs) {
      this.scheduleJob(job);
    }
    console.warn(`[scheduler] Loaded ${jobs.length} active job(s)`);
  }

  private scheduleJob(job: JobRow): void {
    if (!cron.validate(job.cron_expression)) {
      console.warn(`[scheduler] Invalid cron expression for job ${job.id}: ${job.cron_expression}`);
      return;
    }
    const task = cron.schedule(job.cron_expression, () => {
      void this.executeJob(job.id, job.job_type);
    });
    this.tasks.set(job.id, task);
    console.warn(`[scheduler] Scheduled job ${job.id} (${job.job_type}) — ${job.cron_expression}`);
  }

  async runNow(jobId: number): Promise<{ status: 'ok' | 'error'; log: string }> {
    const job = this.db.prepare('SELECT * FROM scheduled_jobs WHERE id = ?').get(jobId) as JobRow | undefined;
    if (!job) return { status: 'error', log: 'Job not found' };
    return this.executeJob(job.id, job.job_type);
  }

  private async executeJob(jobId: number, jobType: JobType): Promise<{ status: 'ok' | 'error'; log: string }> {
    console.warn(`[scheduler] Running job ${jobId} (${jobType})`);
    let status: 'ok' | 'error' = 'ok';
    let log = '';
    try {
      switch (jobType) {
        case 'calendar_reminder':
          log = await runCalendarReminderJob(this.db, this.email);
          break;
        case 'data_cleanup':
          log = await runDataCleanupJob(this.db);
          break;
        case 'nightly_summary':
          log = await runNightlySummaryJob(this.db, this.email);
          break;
        default:
          log = `Unknown job type: ${String(jobType)}`;
          status = 'error';
      }
    } catch (err) {
      status = 'error';
      log = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] Job ${jobId} failed:`, log);
    }

    this.db.prepare(`
      UPDATE scheduled_jobs
      SET last_run_at = datetime('now'), last_run_status = ?, last_run_log = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, log, jobId);

    console.warn(`[scheduler] Job ${jobId} finished [${status}]: ${log.slice(0, 120)}`);
    return { status, log };
  }
}
