import type Database from 'better-sqlite3';
import { NotFoundError } from '../../shared/errors.js';
import type { SavingsInstrumentRow } from './savings.types.js';

export class SavingsRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): (SavingsInstrumentRow & { accrued_interest_raw: number; computed_status: string })[] {
    return this.db.prepare(`
      SELECT s.*, i.name AS institution_name,
        CAST(s.principal AS REAL)
          * (CAST(s.interest_rate AS REAL) / 100.0)
          * (CAST(julianday('now') - julianday(s.start_date) AS REAL) / 365.0)
        AS accrued_interest_raw,
        CASE WHEN s.maturity_date <= date('now') THEN 'matured' ELSE s.status END AS computed_status
      FROM savings_instruments s
      LEFT JOIN institutions i ON s.institution_id = i.id
      ORDER BY s.maturity_date ASC
    `).all() as (SavingsInstrumentRow & { accrued_interest_raw: number; computed_status: string })[];
  }

  findById(id: number): SavingsInstrumentRow | null {
    return this.db.prepare(`
      SELECT s.*, i.name AS institution_name
      FROM savings_instruments s
      LEFT JOIN institutions i ON s.institution_id = i.id
      WHERE s.id = ?
    `).get(id) as SavingsInstrumentRow | null;
  }

  findByIdOrThrow(id: number): SavingsInstrumentRow {
    const row = this.findById(id);
    if (!row) throw new NotFoundError('Savings instrument', id);
    return row;
  }

  create(data: {
    institution_id: number; label: string; instrument_type: string;
    principal: string; interest_rate: string; start_date: string; maturity_date: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO savings_instruments (institution_id, label, instrument_type, principal, interest_rate, start_date, maturity_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      data.institution_id, data.label, data.instrument_type,
      data.principal, data.interest_rate, data.start_date, data.maturity_date,
    );
    return result.lastInsertRowid as number;
  }

  update(id: number, sets: string[], vals: (string | number | null)[]): SavingsInstrumentRow {
    this.db.prepare(`UPDATE savings_instruments SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return this.findByIdOrThrow(id);
  }

  deleteCalendarEvents(id: number): void {
    this.db.prepare('DELETE FROM calendar_events WHERE linked_savings_id = ?').run(id);
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM savings_instruments WHERE id = ?').run(id);
  }

  createMaturityEvent(savingsId: number, maturityDate: string, principalAmount: string): void {
    this.db.prepare(`
      INSERT INTO calendar_events
        (title, event_type, due_date, amount, linked_savings_id, created_at, updated_at)
      VALUES
        (?, 'maturity', ?, ?, ?, datetime('now'), datetime('now'))
    `).run('Savings Maturity', maturityDate, principalAmount, savingsId);
  }
}
