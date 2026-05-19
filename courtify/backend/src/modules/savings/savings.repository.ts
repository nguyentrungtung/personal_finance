import type Database from 'better-sqlite3';
import { NotFoundError } from '../../shared/errors.js';
import { PAGE_SIZE } from '../../shared/pagination.js';
import type { SavingsInstrumentRow, ListSavingsParams } from './savings.types.js';

const ALLOWED_SORT = ['maturity_date', 'principal', 'interest_rate', 'start_date', 'label'];

export class SavingsRepository {
  constructor(private readonly db: Database.Database) {}

  count(conditions: string[], bindings: (string | number)[]): number {
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return (this.db.prepare(`SELECT COUNT(*) AS cnt FROM savings_instruments s ${where}`)
      .get(...bindings) as { cnt: number }).cnt;
  }

  findAll(params: ListSavingsParams = {}): (SavingsInstrumentRow & { accrued_interest_raw: number; computed_status: string })[] {
    const { search, status, instrument_type, sort = 'maturity_date', sortDir = 'asc', page = 1 } = params;
    // ORDER BY is on the outer subquery — no table alias, use column name directly
    const safeSort = ALLOWED_SORT.includes(sort) ? sort : 'maturity_date';
    const safeDir = sortDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    if (instrument_type) { conditions.push('s.instrument_type = ?'); bindings.push(instrument_type); }
    if (search?.trim()) {
      conditions.push('(s.label LIKE ? OR i.name LIKE ?)');
      const term = `%${search.trim()}%`;
      bindings.push(term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * PAGE_SIZE;

    // status filter applied after computed_status is derived (subquery)
    const statusFilter = status ? `WHERE computed_status = ?` : '';
    const statusBindings = status ? [status] : [];

    return this.db.prepare(`
      SELECT * FROM (
        SELECT s.*, i.name AS institution_name,
          CAST(s.principal AS REAL)
            * (CAST(s.interest_rate AS REAL) / 100.0)
            * (CAST(julianday('now') - julianday(s.start_date) AS REAL) / 365.0)
          AS accrued_interest_raw,
          CASE WHEN s.maturity_date <= date('now') THEN 'matured' ELSE s.status END AS computed_status
        FROM savings_instruments s
        LEFT JOIN institutions i ON s.institution_id = i.id
        ${where}
      ) AS sub
      ${statusFilter}
      ORDER BY ${safeSort} ${safeDir}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `).all(...bindings, ...statusBindings) as (SavingsInstrumentRow & { accrued_interest_raw: number; computed_status: string })[];
  }

  countFiltered(params: ListSavingsParams = {}): number {
    const { search, status, instrument_type } = params;
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    if (instrument_type) { conditions.push('s.instrument_type = ?'); bindings.push(instrument_type); }
    if (search?.trim()) {
      conditions.push('(s.label LIKE ? OR i.name LIKE ?)');
      const term = `%${search.trim()}%`;
      bindings.push(term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const statusFilter = status ? `WHERE computed_status = ?` : '';
    const statusBindings = status ? [status] : [];

    return (this.db.prepare(`
      SELECT COUNT(*) AS cnt FROM (
        SELECT s.*,
          CASE WHEN s.maturity_date <= date('now') THEN 'matured' ELSE s.status END AS computed_status
        FROM savings_instruments s
        LEFT JOIN institutions i ON s.institution_id = i.id
        ${where}
      ) AS sub
      ${statusFilter}
    `).get(...bindings, ...statusBindings) as { cnt: number }).cnt;
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
