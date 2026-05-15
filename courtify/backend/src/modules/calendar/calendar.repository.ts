import type Database from 'better-sqlite3';
import type { CreateCalendarEventDto } from './calendar.types.js';

export class CalendarRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(conditions: string[], bindings: (string | number)[]): Record<string, unknown>[] {
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT *,
        CAST(julianday(due_date) - julianday(date('now')) AS INTEGER) AS days_until
      FROM calendar_events
      ${where}
      ORDER BY due_date ASC
    `).all(...bindings) as Record<string, unknown>[];
  }

  findById(id: number): Record<string, unknown> | undefined {
    return this.db.prepare(`
      SELECT *, CAST(julianday(due_date) - julianday(date('now')) AS INTEGER) AS days_until
      FROM calendar_events WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;
  }

  create(data: CreateCalendarEventDto): number {
    const result = this.db.prepare(`
      INSERT INTO calendar_events
        (title, event_type, due_date, amount, asset_class_id,
         linked_savings_id, linked_loan_id, linked_ledger_id, notes, is_dismissed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      data.title, data.event_type, data.due_date,
      data.amount ?? null, data.asset_class_id ?? null,
      data.linked_savings_id ?? null, data.linked_loan_id ?? null,
      data.linked_ledger_id ?? null, data.notes ?? null,
    );
    return result.lastInsertRowid as number;
  }

  update(id: number, sets: string[], vals: (string | number | null)[]): void {
    this.db.prepare(`UPDATE calendar_events SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
  }

  dismiss(id: number): void {
    this.db.prepare("UPDATE calendar_events SET is_dismissed = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  }
}
