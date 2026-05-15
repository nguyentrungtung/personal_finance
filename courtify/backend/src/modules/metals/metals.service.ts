import { BusinessRuleError } from '../../shared/errors.js';
import type { MetalsRepository } from './metals.repository.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';
import type { CreateMetalDto, UpdateMetalDto, MetalHolding, MetalHoldingRow } from './metals.types.js';

const METALS_ASSET_CLASS_ID = 1; // asset_classes seed: metals=1

const WEIGHT_UNIT_MAP: Record<string, number> = {
  chi: 3.75,
  luong: 37.5,
  gram: 1,
};

function toGrams(weightDisplay: number, weightUnit: string): number {
  const factor = WEIGHT_UNIT_MAP[weightUnit];
  if (!factor) throw new BusinessRuleError(`Unknown weight unit: ${weightUnit}`, 'INVALID_WEIGHT_UNIT');
  return weightDisplay * factor;
}

function toHolding(r: MetalHoldingRow): MetalHolding {
  return {
    ...r,
    purchase_value: String((r.purchase_value_raw ?? 0).toFixed(4)),
    current_value: String((r.current_value_raw ?? 0).toFixed(4)),
    unrealised_gain: String((r.unrealised_gain_raw ?? 0).toFixed(4)),
  };
}

export class MetalsService {
  constructor(
    private readonly repo: MetalsRepository,
    private readonly ledger: LedgerService,
    private readonly dashboard: DashboardService,
  ) {}

  listAll(): MetalHolding[] {
    return this.repo.findAll().map(toHolding);
  }

  getById(id: number): MetalHolding {
    return toHolding(this.repo.findByIdOrThrow(id));
  }

  create(data: CreateMetalDto): MetalHolding {
    const weightGrams = String(toGrams(data.weight_display, data.weight_unit).toFixed(4));

    const holding = this.repo.create({
      ...data,
      weight_grams: weightGrams,
      weight_display: String(data.weight_display),
    });
    this.dashboard.upsertSnapshot();

    const purchaseValue = parseFloat(holding.purchase_price_per_gram) * parseFloat(holding.weight_grams);
    const metalLabel = data.label ? `${data.metal_type} (${data.label})` : data.metal_type;
    this.ledger.autoEntry({
      source_module: 'metals',
      source_id: holding.id,
      asset_class_id: METALS_ASSET_CLASS_ID,
      institution_id: data.institution_id,
      entry_type: 'other',
      description: `Mua ${metalLabel} — ${data.weight_display} ${data.weight_unit}`,
      amount: String(-Math.round(purchaseValue)),
      transaction_date: data.purchase_date,
      notes: `Giá mua: ${data.purchase_price_per_gram} ₫/gram · Độ tinh khiết: ${data.purity}%`,
    });

    return toHolding(holding);
  }

  update(id: number, data: UpdateMetalDto): MetalHolding {
    const existing = this.repo.findByIdOrThrow(id);
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];

    if (data.metal_type !== undefined) { sets.push('metal_type = ?'); vals.push(data.metal_type); }
    if (data.label !== undefined) { sets.push('label = ?'); vals.push(data.label); }

    const newDisplay = data.weight_display ?? parseFloat(existing.weight_display);
    const newUnit = data.weight_unit ?? existing.weight_unit;
    if (data.weight_display !== undefined || data.weight_unit !== undefined) {
      const newGrams = toGrams(newDisplay, newUnit);
      sets.push('weight_grams = ?'); vals.push(String(newGrams.toFixed(4)));
      sets.push('weight_display = ?'); vals.push(String(newDisplay));
      sets.push('weight_unit = ?'); vals.push(newUnit);
    }

    if (data.purity !== undefined) { sets.push('purity = ?'); vals.push(data.purity); }
    if (data.purchase_price_per_gram !== undefined) { sets.push('purchase_price_per_gram = ?'); vals.push(data.purchase_price_per_gram); }
    if (data.current_price_per_gram !== undefined) { sets.push('current_price_per_gram = ?'); vals.push(data.current_price_per_gram); }
    if (data.purchase_date !== undefined) { sets.push('purchase_date = ?'); vals.push(data.purchase_date); }
    if (data.institution_id !== undefined) { sets.push('institution_id = ?'); vals.push(data.institution_id); }

    const updated = this.repo.update(id, sets, vals);
    this.dashboard.upsertSnapshot();
    return toHolding(updated);
  }

  delete(id: number): { id: number; deleted: boolean } {
    this.repo.findByIdOrThrow(id);
    this.repo.delete(id);
    this.ledger.softDeleteAutoEntries('metals', id);
    this.dashboard.upsertSnapshot();
    return { id, deleted: true };
  }
}
