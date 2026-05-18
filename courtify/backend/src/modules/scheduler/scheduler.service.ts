import { NotFoundError } from '../../shared/errors.js';
import { EmailService } from '../../infrastructure/scheduler/email.service.js';
import type { CronEngine } from '../../infrastructure/scheduler/cron.engine.js';
import type { SchedulerRepository } from './scheduler.repository.js';
import type { UpdateJobDto, UpdateSmtpDto } from './scheduler.types.js';

export class SchedulerService {
  constructor(
    private readonly repo: SchedulerRepository,
    private readonly email: EmailService,
    private readonly cronEngine: CronEngine,
  ) {}

  listJobs() {
    return this.repo.listJobs();
  }

  getJob(id: number) {
    const job = this.repo.getJob(id);
    if (!job) throw new NotFoundError('Scheduled job', id);
    return job;
  }

  updateJob(id: number, dto: UpdateJobDto) {
    this.getJob(id);
    this.repo.updateJob(id, dto);
    // Reload cron engine so enable/disable + new expression takes effect immediately
    this.cronEngine.reloadAll();
    return this.getJob(id);
  }

  async runJobNow(id: number) {
    this.getJob(id);
    const result = await this.cronEngine.runNow(id);
    return { id, ...result };
  }

  getSmtpConfig() {
    return this.repo.getSmtpConfig();
  }

  updateSmtpConfig(dto: UpdateSmtpDto) {
    return this.repo.updateSmtpConfig(dto);
  }

  async testSmtp(to: string) {
    const cfg = this.repo.getSmtpConfigRaw();
    if (!cfg.user) throw new Error('SMTP not configured — set user/password first');
    await this.email.sendMail(cfg, {
      to,
      subject: '[Courtify] Test email — SMTP works ✓',
      html: `
        <div style="font-family:sans-serif;background:#111;color:#e5e5e5;padding:24px;border-radius:8px">
          <h2 style="color:#22c55e">✓ Kết nối SMTP thành công</h2>
          <p>Email test từ <strong>Courtify Wealth Dashboard</strong> đã được gửi thành công.</p>
          <p style="color:#6b7280;font-size:12px">Provider: ${cfg.provider} | From: ${cfg.from_email ?? cfg.user}</p>
        </div>
      `,
    });
    return { sent: true, to };
  }
}
