import type Database from 'better-sqlite3';
import { NotFoundError } from '../../shared/errors.js';
import type { ListLotsParams, FifoLot } from './investment.types.js';

export class InvestmentRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(params: ListLotsParams = {}) {
    const { assetClass, subtype, view = 'lot' } = params;

    const conditions: string[] = ["al.status IN ('active', 'partial_closed')"];
    const bindings: (string | number)[] = [];

    if (assetClass) {
      conditions.push('ac.code = ?');
      bindings.push(assetClass);
    }
    if (subtype) {
      conditions.push('al.asset_subtype = ?');
      bindings.push(subtype);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    if (view === 'aggregated') {
      return this.db.prepare(`
        SELECT
          al.asset_name,
          al.asset_subtype,
          al.unit_label,
          ac.code AS asset_class_code,
          SUM(CAST(al.remaining_volume AS REAL)) AS total_remaining_volume,
          SUM(CAST(al.remaining_volume AS REAL) * CAST(al.buy_price_per_unit AS REAL))
            / SUM(CAST(al.remaining_volume AS REAL)) AS weighted_avg_cost,
          MAX(CAST(al.current_price_per_unit AS REAL)) AS current_price_per_unit,
          SUM(CAST(al.remaining_volume AS REAL) * CAST(al.current_price_per_unit AS REAL)) AS total_current_value,
          (MAX(CAST(al.current_price_per_unit AS REAL))
            - SUM(CAST(al.remaining_volume AS REAL) * CAST(al.buy_price_per_unit AS REAL))
              / SUM(CAST(al.remaining_volume AS REAL)))
            / (SUM(CAST(al.remaining_volume AS REAL) * CAST(al.buy_price_per_unit AS REAL))
              / SUM(CAST(al.remaining_volume AS REAL))) * 100 AS blended_pct_change
        FROM asset_lots al
        JOIN asset_classes ac ON al.asset_class_id = ac.id
        ${where}
        GROUP BY al.asset_name, al.asset_subtype, al.unit_label, ac.code
      `).all(...bindings);
    }

    return this.db.prepare(`
      SELECT al.*,
        ac.code AS asset_class_code,
        i.name AS institution_name,
        CAST(al.remaining_volume AS REAL) * CAST(al.current_price_per_unit AS REAL) AS current_value,
        CAST(al.remaining_volume AS REAL) * CAST(al.current_price_per_unit AS REAL)
          - CAST(al.remaining_volume AS REAL) * CAST(al.buy_price_per_unit AS REAL) AS unrealised_pnl,
        (CAST(al.current_price_per_unit AS REAL) - CAST(al.buy_price_per_unit AS REAL))
          / CAST(al.buy_price_per_unit AS REAL) * 100 AS pct_change
      FROM asset_lots al
      JOIN asset_classes ac ON al.asset_class_id = ac.id
      LEFT JOIN institutions i ON al.institution_id = i.id
      ${where}
      ORDER BY al.purchase_date DESC
    `).all(...bindings);
  }

  findById(id: number) {
    const row = this.db.prepare('SELECT * FROM asset_lots WHERE id = ?').get(id);
    if (!row) throw new NotFoundError('Lot', id);
    return row;
  }

  findLotsByAsset(assetName: string, assetClassId?: number): FifoLot[] {
    const conditions = ["status IN ('active', 'partial_closed')", 'asset_name = ?'];
    const bindings: (string | number)[] = [assetName];
    if (assetClassId) {
      conditions.push('asset_class_id = ?');
      bindings.push(assetClassId);
    }
    return this.db.prepare(`
      SELECT id, CAST(remaining_volume AS REAL) AS remainingVolume,
             CAST(buy_price_per_unit AS REAL) AS buyPricePerUnit, purchase_date AS purchaseDate
      FROM asset_lots WHERE ${conditions.join(' AND ')} ORDER BY purchase_date ASC
    `).all(...bindings) as FifoLot[];
  }

  insertLot(data: {
    asset_class_id: number; asset_name: string; asset_subtype: string;
    institution_id?: number; purchase_date: string; volume: string;
    buy_price_per_unit: string; current_price_per_unit: string;
    unit_label?: string; notes?: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO asset_lots
        (asset_class_id, asset_name, asset_subtype, institution_id, purchase_date,
         original_volume, remaining_volume, buy_price_per_unit, current_price_per_unit,
         unit_label, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      data.asset_class_id,
      data.asset_name,
      data.asset_subtype,
      data.institution_id ?? null,
      data.purchase_date,
      data.volume,
      data.volume,
      data.buy_price_per_unit,
      data.current_price_per_unit,
      data.unit_label ?? 'shares',
      data.notes ?? null,
    );
    return result.lastInsertRowid as number;
  }

  insertTransaction(data: {
    lot_id: number; transaction_type: string; transaction_date: string;
    volume: string; price_per_unit: string; fee: string; net_amount: string;
    realized_pnl?: string | null;
  }): void {
    this.db.prepare(`
      INSERT INTO asset_transactions
        (lot_id, transaction_type, transaction_date, volume, price_per_unit, fee, net_amount, realized_pnl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.lot_id, data.transaction_type, data.transaction_date,
      data.volume, data.price_per_unit, data.fee, data.net_amount,
      data.realized_pnl ?? null,
    );
  }

  updateLotVolume(lotId: number, newRemaining: string, newStatus: string): void {
    this.db.prepare("UPDATE asset_lots SET remaining_volume = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newRemaining, newStatus, lotId);
  }

  updateLotPrice(lotId: number, newPrice: string): void {
    this.db.prepare("UPDATE asset_lots SET current_price_per_unit = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newPrice, lotId);
  }

  getLotAssetClassId(lotId: number): number | null {
    const row = this.db.prepare('SELECT asset_class_id FROM asset_lots WHERE id = ?').get(lotId) as { asset_class_id: number } | null;
    return row?.asset_class_id ?? null;
  }

  getTradeHistory(params: { assetClass?: string; dateFrom?: string; dateTo?: string; }) {
    const { assetClass, dateFrom, dateTo } = params;
    const conditions: string[] = ["at.transaction_type = 'sell'"];
    const bindings: (string | number)[] = [];

    if (assetClass) {
      conditions.push('ac.code = ?');
      bindings.push(assetClass);
    }
    if (dateFrom) {
      conditions.push('at.transaction_date >= ?');
      bindings.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('at.transaction_date <= ?');
      bindings.push(dateTo);
    }

    return this.db.prepare(`
      SELECT at.*, al.asset_name, al.asset_subtype, al.buy_price_per_unit AS lot_buy_price,
             ac.code AS asset_class_code
      FROM asset_transactions at
      JOIN asset_lots al ON at.lot_id = al.id
      JOIN asset_classes ac ON al.asset_class_id = ac.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY at.transaction_date DESC
    `).all(...bindings);
  }

  getLotById(id: number) {
    return this.db.prepare('SELECT * FROM asset_lots WHERE id = ?').get(id);
  }

  dbTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
