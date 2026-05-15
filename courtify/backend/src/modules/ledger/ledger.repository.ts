import type Database from 'better-sqlite3';
import type { AutoLedgerParams, SourceModule } from './ledger.types.js';

const PAGE_SIZE = 50;

export class LedgerRepository {
  constructor(private readonly db: Database.Database) {}

  insertAutoEntry(params: AutoLedgerParams): void {
    this.db.prepare(`
      INSERT INTO ledger_entries
        (asset_class_id, institution_id, entry_type, description, amount,
         status, transaction_date, notes, source_module, source_id, is_auto)
      VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, 1)
    `).run(
      params.asset_class_id,
      params.institution_id ?? null,
      params.entry_type,
      params.description,
      params.amount,
      params.transaction_date,
      params.notes ?? null,
      params.source_module,
      params.source_id,
    );
  }

  softDeleteAutoEntries(source_module: SourceModule, source_id: number): void {
    this.db.prepare(`
      UPDATE ledger_entries
      SET deleted_at = datetime('now'), updated_at = datetime('now')
      WHERE source_module = ? AND source_id = ? AND is_auto = 1 AND deleted_at IS NULL
    `).run(source_module, source_id);
  }

  countEntries(conditions: string[], bindings: (string | number)[]): number {
    const where = `WHERE ${conditions.join(' AND ')}`;
    const row = this.db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM ledger_entries le
      JOIN asset_classes ac ON le.asset_class_id = ac.id
      ${where}
    `).get(...bindings) as { cnt: number };
    return row.cnt;
  }

  listEntries(conditions: string[], bindings: (string | number)[], safeSort: string, safeDir: string, page: number): Record<string, unknown>[] {
    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * PAGE_SIZE;
    return this.db.prepare(`
      SELECT le.*, ac.code AS asset_class_code, ac.label AS asset_class_label,
             i.name AS institution_name
      FROM ledger_entries le
      JOIN asset_classes ac ON le.asset_class_id = ac.id
      LEFT JOIN institutions i ON le.institution_id = i.id
      ${where}
      ORDER BY ${safeSort} ${safeDir}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `).all(...bindings) as Record<string, unknown>[];
  }

  findById(id: number): Record<string, unknown> | undefined {
    return this.db.prepare(`
      SELECT le.*, ac.code AS asset_class_code, i.name AS institution_name
      FROM ledger_entries le
      JOIN asset_classes ac ON le.asset_class_id = ac.id
      LEFT JOIN institutions i ON le.institution_id = i.id
      WHERE le.id = ? AND le.deleted_at IS NULL
    `).get(id) as Record<string, unknown> | undefined;
  }

  insertEntry(data: {
    asset_class_id: number; institution_id?: number; entry_type: string;
    description: string; amount: string; status?: string; transaction_date: string; notes?: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO ledger_entries (asset_class_id, institution_id, entry_type, description, amount, status, transaction_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.asset_class_id,
      data.institution_id ?? null,
      data.entry_type,
      data.description,
      data.amount,
      data.status ?? 'completed',
      data.transaction_date,
      data.notes ?? null,
    );
    return result.lastInsertRowid as number;
  }

  updateEntry(id: number, sets: string[], vals: (string | number | null)[]): void {
    this.db.prepare(`UPDATE ledger_entries SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  }

  softDeleteEntry(id: number): void {
    this.db.prepare("UPDATE ledger_entries SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
  }

  findDeletedAt(id: number): { id: number; deleted_at: string } {
    return this.db.prepare('SELECT id, deleted_at FROM ledger_entries WHERE id = ?').get(id) as { id: number; deleted_at: string };
  }
}
