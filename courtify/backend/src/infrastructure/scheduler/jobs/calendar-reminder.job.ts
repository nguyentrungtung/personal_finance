import type Database from 'better-sqlite3';
import type { EmailService } from '../email.service.js';

export async function runCalendarReminderJob(db: Database.Database, email: EmailService): Promise<string> {
  // Load settings
  const settings = db.prepare('SELECT notification_days_advance, notification_emails FROM settings WHERE id = 1').get() as
    { notification_days_advance: string | null; notification_emails: string | null } | undefined;

  const days: number[] = JSON.parse(settings?.notification_days_advance ?? '[1,7]');
  const emails: string[] = JSON.parse(settings?.notification_emails ?? '[]');

  if (emails.length === 0) return 'Skipped: no notification_emails configured';

  // Find upcoming events due in exactly N days
  const placeholders = days.map(() => '?').join(', ');
  const events = db.prepare(`
    SELECT title, event_type, due_date,
      CAST(julianday(due_date) - julianday(date('now')) AS INTEGER) AS days_until
    FROM calendar_events
    WHERE is_dismissed = 0
      AND CAST(julianday(due_date) - julianday(date('now')) AS INTEGER) IN (${placeholders})
    ORDER BY due_date ASC
  `).all(...days) as { title: string; event_type: string; due_date: string; days_until: number }[];

  if (events.length === 0) return 'No upcoming events match reminder window';

  const rows = events.map(e => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${e.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${e.event_type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${e.due_date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:${e.days_until <= 1 ? '#ef4444' : '#f59e0b'}">${e.days_until} ngày nữa</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:sans-serif;background:#111;color:#e5e5e5;padding:24px;border-radius:8px;max-width:600px">
      <h2 style="color:#22c55e;margin:0 0 16px">⏰ Nhắc nhở sự kiện tài chính</h2>
      <p style="color:#9ca3af;margin:0 0 16px">Bạn có <strong>${events.length}</strong> sự kiện sắp đến hạn:</p>
      <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#1f2937">
            <th style="padding:10px 12px;text-align:left;color:#9ca3af;font-size:12px">Tiêu đề</th>
            <th style="padding:10px 12px;text-align:left;color:#9ca3af;font-size:12px">Loại</th>
            <th style="padding:10px 12px;text-align:left;color:#9ca3af;font-size:12px">Ngày</th>
            <th style="padding:10px 12px;text-align:left;color:#9ca3af;font-size:12px">Còn lại</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#6b7280;font-size:12px;margin:16px 0 0">— Courtify Wealth Dashboard</p>
    </div>
  `;

  const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get() as any;
  await email.sendMail(smtp, {
    to: emails,
    subject: `[Courtify] ${events.length} sự kiện sắp đến hạn`,
    html,
  });

  return `Sent reminder for ${events.length} events to ${emails.join(', ')}`;
}
