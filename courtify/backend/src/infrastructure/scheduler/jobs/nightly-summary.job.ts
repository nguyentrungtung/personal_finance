import type Database from 'better-sqlite3';
import type { EmailService } from '../email.service.js';

export async function runNightlySummaryJob(db: Database.Database, email: EmailService): Promise<string> {
  const settings = db.prepare('SELECT notification_emails FROM settings WHERE id = 1').get() as
    { notification_emails: string | null } | undefined;
  const emails: string[] = JSON.parse(settings?.notification_emails ?? '[]');
  if (emails.length === 0) return 'Skipped: no notification_emails configured';

  const today = new Date().toISOString().slice(0, 10);

  // Today's ledger entries
  const ledgerRows = db.prepare(`
    SELECT entry_type, description, amount
    FROM ledger_entries
    WHERE date(transaction_date) = ?
    ORDER BY transaction_date DESC
    LIMIT 20
  `).all(today) as { entry_type: string; description: string; amount: string }[];

  // Current portfolio snapshot
  const dashboard = db.prepare(`
    SELECT total_vnd, metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd
    FROM net_worth_snapshots
    ORDER BY snapshot_date DESC LIMIT 1
  `).get() as { total_vnd: string; metals_vnd: string; markets_vnd: string; liquidity_vnd: string; real_estate_vnd: string } | undefined;

  const fmt = (n: string | undefined) =>
    n ? Number(n).toLocaleString('vi-VN') + ' ₫' : '—';

  const ledgerHtml = ledgerRows.length > 0
    ? ledgerRows.map(r => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2a2a">${r.description}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2a2a;color:#9ca3af">${r.entry_type}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2a2a;color:${Number(r.amount) >= 0 ? '#22c55e' : '#ef4444'};text-align:right">${fmt(r.amount)}</td>
        </tr>`).join('')
    : '<tr><td colspan="3" style="padding:12px;color:#6b7280;text-align:center">Không có giao dịch hôm nay</td></tr>';

  const html = `
    <div style="font-family:sans-serif;background:#111;color:#e5e5e5;padding:24px;border-radius:8px;max-width:600px">
      <h2 style="color:#22c55e;margin:0 0 4px">📊 Báo cáo tổng hợp hàng đêm</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px">${today}</p>

      ${dashboard ? `
      <div style="background:#1a1a1a;border-radius:6px;padding:16px;margin-bottom:20px">
        <h3 style="color:#9ca3af;font-size:12px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">Danh mục đầu tư</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><span style="color:#6b7280;font-size:11px">Tổng tài sản</span><br><strong style="font-size:18px;color:#22c55e">${fmt(dashboard.total_vnd)}</strong></div>
          <div><span style="color:#6b7280;font-size:11px">Kim loại</span><br><span>${fmt(dashboard.metals_vnd)}</span></div>
          <div><span style="color:#6b7280;font-size:11px">Thị trường</span><br><span>${fmt(dashboard.markets_vnd)}</span></div>
          <div><span style="color:#6b7280;font-size:11px">Thanh khoản</span><br><span>${fmt(dashboard.liquidity_vnd)}</span></div>
        </div>
      </div>` : ''}

      <h3 style="color:#9ca3af;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Giao dịch hôm nay (${ledgerRows.length})</h3>
      <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:6px;overflow:hidden">
        <tbody>${ledgerHtml}</tbody>
      </table>

      <p style="color:#6b7280;font-size:12px;margin:16px 0 0">— Courtify Wealth Dashboard</p>
    </div>
  `;

  const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get() as any;
  await email.sendMail(smtp, {
    to: emails,
    subject: `[Courtify] Báo cáo tổng hợp ${today}`,
    html,
  });

  return `Sent nightly summary to ${emails.join(', ')} (${ledgerRows.length} ledger entries today)`;
}
