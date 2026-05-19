import type Database from 'better-sqlite3';
import { NotFoundError } from '../../shared/errors.js';
import { PAGE_SIZE } from '../../shared/pagination.js';
import type { ListLoansParams } from './loans.types.js';

const ALLOWED_SORT = ['counterparty_name', 'principal', 'expected_due_date', 'status', 'date_issued'];

const LOAN_INNER_QUERY = `
  SELECT l.*,
    CAST(l.principal AS REAL) - COALESCE(
      (SELECT SUM(CAST(lp.paid_amount AS REAL)) FROM loan_payments lp
       WHERE lp.loan_id = l.id AND lp.status = 'paid'), 0
    ) AS remaining_balance,
    CASE
      WHEN CAST(l.principal AS REAL) - COALESCE(
        (SELECT SUM(CAST(lp.paid_amount AS REAL)) FROM loan_payments lp
         WHERE lp.loan_id = l.id AND lp.status = 'paid'), 0
      ) <= 0 THEN 'settled'
      WHEN l.expected_due_date < date('now') THEN 'overdue'
      ELSE 'active'
    END AS computed_status
  FROM loans l
`;

export class LoansRepository {
  constructor(private readonly db: Database.Database) {}

  countFiltered(params: ListLoansParams = {}): number {
    const { type, status, search } = params;
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    if (type) { conditions.push("l.loan_type = ?"); bindings.push(type); }
    if (search?.trim()) {
      conditions.push('l.counterparty_name LIKE ?');
      bindings.push(`%${search.trim()}%`);
    }

    const innerWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const statusFilter = status ? 'WHERE computed_status = ?' : '';
    const statusBindings = status ? [status] : [];

    return (this.db.prepare(`
      SELECT COUNT(*) AS cnt FROM (${LOAN_INNER_QUERY} ${innerWhere}) AS sub ${statusFilter}
    `).get(...bindings, ...statusBindings) as { cnt: number }).cnt;
  }

  findAll(params: ListLoansParams = {}) {
    const { type, status, search, sort = 'date_issued', sortDir = 'desc', page = 1 } = params;
    const safeSort = ALLOWED_SORT.includes(sort) ? sort : 'date_issued';
    const safeDir = sortDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    if (type) { conditions.push('l.loan_type = ?'); bindings.push(type); }
    if (search?.trim()) {
      conditions.push('l.counterparty_name LIKE ?');
      bindings.push(`%${search.trim()}%`);
    }

    const innerWhere = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const statusFilter = status ? 'WHERE computed_status = ?' : '';
    const statusBindings = status ? [status] : [];
    const offset = (page - 1) * PAGE_SIZE;

    return this.db.prepare(`
      SELECT * FROM (${LOAN_INNER_QUERY} ${innerWhere}) AS sub
      ${statusFilter}
      ORDER BY ${safeSort} ${safeDir}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `).all(...bindings, ...statusBindings) as Record<string, unknown>[];
  }

  findById(id: number): (Record<string, unknown> & { remaining_balance: number }) | null {
    return this.db.prepare(`
      SELECT l.*,
        CAST(l.principal AS REAL) - COALESCE(
          (SELECT SUM(CAST(lp.paid_amount AS REAL)) FROM loan_payments lp
           WHERE lp.loan_id = l.id AND lp.status = 'paid'), 0
        ) AS remaining_balance
      FROM loans l WHERE l.id = ?
    `).get(id) as (Record<string, unknown> & { remaining_balance: number }) | null;
  }

  findByIdOrThrow(id: number) {
    const row = this.findById(id);
    if (!row) throw new NotFoundError('Loan', id);
    return row;
  }

  create(data: {
    loan_type: string; counterparty_name: string; principal: string;
    date_issued: string; expected_due_date: string; repayment_terms?: string;
    description?: string; interest_rate?: string; interest_type?: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO loans (loan_type, counterparty_name, principal, date_issued, expected_due_date, repayment_terms, description, interest_rate, interest_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      data.loan_type, data.counterparty_name, data.principal,
      data.date_issued, data.expected_due_date,
      data.repayment_terms ?? null, data.description ?? null,
      data.interest_rate ?? null, data.interest_type ?? null,
    );
    return result.lastInsertRowid as number;
  }

  update(id: number, sets: string[], vals: (string | number | null)[]) {
    this.db.prepare(`UPDATE loans SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return this.findByIdOrThrow(id);
  }

  countPayments(id: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS cnt FROM loan_payments WHERE loan_id = ?').get(id) as { cnt: number }).cnt;
  }

  deletePayments(id: number): void {
    this.db.prepare('DELETE FROM loan_payments WHERE loan_id = ?').run(id);
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM loans WHERE id = ?').run(id);
  }

  listPayments(loanId: number) {
    return this.db.prepare('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY due_date ASC').all(loanId);
  }

  addPayment(loanId: number, data: {
    paid_amount: string; due_date: string; scheduled_amount?: string; notes?: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO loan_payments (loan_id, scheduled_amount, paid_amount, due_date, paid_date, status, notes)
      VALUES (?, ?, ?, ?, date('now'), 'paid', ?)
    `).run(loanId, data.scheduled_amount ?? data.paid_amount, data.paid_amount, data.due_date, data.notes ?? null);
    return result.lastInsertRowid as number;
  }

  settleLoan(id: number): void {
    this.db.prepare("UPDATE loans SET status = 'settled', updated_at = datetime('now') WHERE id = ?").run(id);
  }

  createLoanSettledEvent(loanId: number, settlementDate: string): void {
    this.db.prepare(`
      INSERT INTO calendar_events
        (title, event_type, due_date, linked_loan_id, created_at, updated_at)
      VALUES
        (?, 'loan_settled', ?, ?, datetime('now'), datetime('now'))
    `).run('Loan Settled', settlementDate, loanId);
  }

  getPaymentById(id: number) {
    return this.db.prepare('SELECT * FROM loan_payments WHERE id = ?').get(id);
  }
}
