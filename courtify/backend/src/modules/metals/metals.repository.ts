import type Database from 'better-sqlite3';
import type { MetalHoldingRow, ListMetalsParams } from './metals.types.js';
import { NotFoundError } from '../../shared/errors.js';
import { PAGE_SIZE } from '../../shared/pagination.js';

const ALLOWED_SORT = ['purchase_date', 'metal_type', 'weight_grams', 'purchase_price_per_gram', 'current_price_per_gram'];

export class MetalsRepository {
  constructor(private readonly db: Database.Database) {}

  countFiltered(params: ListMetalsParams = {}): number {
    const { search, metal_type } = params;
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];
    if (metal_type) { conditions.push('m.metal_type = ?'); bindings.push(metal_type); }
    if (search?.trim()) {
      conditions.push('(m.label LIKE ? OR i.name LIKE ?)');
      const term = `%${search.trim()}%`;
      bindings.push(term, term);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return (this.db.prepare(`
      SELECT COUNT(*) AS cnt FROM metals_holdings m
      LEFT JOIN institutions i ON m.institution_id = i.id ${where}
    `).get(...bindings) as { cnt: number }).cnt;
  }

  findAll(params: ListMetalsParams = {}): MetalHoldingRow[] {
    const { search, metal_type, sort = 'purchase_date', sortDir = 'desc', page = 1 } = params;
    const safeSort = ALLOWED_SORT.includes(sort) ? `m.${sort}` : 'm.purchase_date';
    const safeDir = sortDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const bindings: (string | number)[] = [];
    if (metal_type) { conditions.push('m.metal_type = ?'); bindings.push(metal_type); }
    if (search?.trim()) {
      conditions.push('(m.label LIKE ? OR i.name LIKE ?)');
      const term = `%${search.trim()}%`;
      bindings.push(term, term);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * PAGE_SIZE;

    return this.db.prepare(`
      SELECT m.*, i.name AS institution_name,
        CAST(m.weight_grams AS REAL) * CAST(m.purchase_price_per_gram AS REAL) AS purchase_value_raw,
        CAST(m.weight_grams AS REAL) * CAST(m.current_price_per_gram AS REAL) AS current_value_raw,
        CAST(m.weight_grams AS REAL) * CAST(m.current_price_per_gram AS REAL)
          - CAST(m.weight_grams AS REAL) * CAST(m.purchase_price_per_gram AS REAL) AS unrealised_gain_raw
      FROM metals_holdings m
      LEFT JOIN institutions i ON m.institution_id = i.id
      ${where}
      ORDER BY ${safeSort} ${safeDir}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `).all(...bindings) as MetalHoldingRow[];
  }

  findById(id: number): MetalHoldingRow | null {
    return this.db.prepare(`
      SELECT m.*, i.name AS institution_name
      FROM metals_holdings m
      LEFT JOIN institutions i ON m.institution_id = i.id
      WHERE m.id = ?
    `).get(id) as MetalHoldingRow | null;
  }

  findByIdOrThrow(id: number): MetalHoldingRow {
    const row = this.findById(id);
    if (!row) throw new NotFoundError('Metal holding', id);
    return row;
  }

  create(data: {
    metal_type: string; label?: string; weight_grams: string; weight_display: string;
    weight_unit: string; purity: string; purchase_price_per_gram: string;
    current_price_per_gram: string; purchase_date: string; institution_id?: number;
  }): MetalHoldingRow {
    const result = this.db.prepare(`
      INSERT INTO metals_holdings
        (metal_type, label, weight_grams, weight_display, weight_unit, purity,
         purchase_price_per_gram, current_price_per_gram, purchase_date, institution_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.metal_type, data.label ?? null, data.weight_grams, data.weight_display,
      data.weight_unit, data.purity, data.purchase_price_per_gram,
      data.current_price_per_gram, data.purchase_date, data.institution_id ?? null,
    );
    return this.findByIdOrThrow(result.lastInsertRowid as number);
  }

  update(id: number, sets: string[], vals: (string | number | null)[]): MetalHoldingRow {
    this.db.prepare(`UPDATE metals_holdings SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return this.findByIdOrThrow(id);
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM metals_holdings WHERE id = ?').run(id);
  }
}
