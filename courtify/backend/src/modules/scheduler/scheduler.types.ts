export type JobType = 'calendar_reminder' | 'data_cleanup' | 'nightly_summary';

export interface ScheduledJob {
  id: number;
  name: string;
  job_type: JobType;
  cron_expression: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: 'ok' | 'error' | null;
  last_run_log: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmtpConfig {
  provider: 'gmail' | 'custom';
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  password: string | null; // masked as '***' in API responses
  from_name: string;
  from_email: string | null;
}

export interface SmtpConfigRaw extends Omit<SmtpConfig, 'secure'> {
  secure: number; // 0 | 1 in SQLite
}

export interface UpdateJobDto {
  name?: string;
  cron_expression?: string;
  enabled?: boolean;
}

export interface UpdateSmtpDto {
  provider?: 'gmail' | 'custom';
  host?: string | null;
  port?: number | null;
  secure?: boolean;
  user?: string | null;
  password?: string | null;
  from_name?: string;
  from_email?: string | null;
}
