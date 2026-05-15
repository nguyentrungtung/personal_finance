import type Database from 'better-sqlite3';
import type { MetalHoldingRow } from './metals.types.js';
import { NotFoundError } from '../../shared/errors.js';

export class MetalsRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): MetalHoldingRow[] {
    return this.db.prepare(`
      SELECT m.*, i.name AS institution_name,
        CAST(m.weight_grams AS REAL) * CAST(m.purchase_price_per_gram AS REAL) AS purchase_value_raw,
        CAST(m.weight_grams AS REAL) * CAST(m.current_price_per_gram AS REAL) AS current_value_raw,
        CAST(m.weight_grams AS REAL) * CAST(m.current_price_per_gram AS REAL)
          - CAST(m.weight_grams AS REAL) * CAST(m.purchase_price_per_gram AS REAL) AS unrealised_gain_raw
      FROM metals_holdings m
      LEFT JOIN institutions i ON m.institution_id = i.id
      ORDER BY m.purchase_date DESC
    `).all() as MetalHoldingRow[];
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
