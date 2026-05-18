import nodemailer from 'nodemailer';
import type { SmtpConfigRaw } from '../../modules/scheduler/scheduler.types.js';

export interface MailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export class EmailService {
  private getTransporter(cfg: SmtpConfigRaw) {
    const isGmail = cfg.provider === 'gmail';
    return nodemailer.createTransport({
      host: isGmail ? 'smtp.gmail.com' : (cfg.host ?? 'localhost'),
      port: isGmail ? 465 : (cfg.port ?? 587),
      secure: isGmail ? true : (cfg.secure === 1),
      auth: cfg.user && cfg.password
        ? { user: cfg.user, pass: cfg.password }
        : undefined,
    });
  }

  async sendMail(cfg: SmtpConfigRaw, payload: MailPayload): Promise<void> {
    const transporter = this.getTransporter(cfg);
    const from = cfg.from_email
      ? `"${cfg.from_name}" <${cfg.from_email}>`
      : cfg.user ?? 'noreply@courtify.app';

    await transporter.sendMail({
      from,
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  }

  async verify(cfg: SmtpConfigRaw): Promise<void> {
    const transporter = this.getTransporter(cfg);
    await transporter.verify();
  }
}
