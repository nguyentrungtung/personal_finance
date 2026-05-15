import type { SavingsRepository } from './savings.repository.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';
import type { CreateSavingsDto, UpdateSavingsDto } from './savings.types.js';

const LIQUIDITY_ASSET_CLASS_ID = 3; // asset_classes seed: liquidity=3

export class SavingsService {
  constructor(
    private readonly repo: SavingsRepository,
    private readonly ledger: LedgerService,
    private readonly dashboard: DashboardService,
  ) {}

  listAll() {
    return this.repo.findAll().map(r => ({
      ...r,
      accrued_interest: String(Math.max(0, r.accrued_interest_raw ?? 0).toFixed(4)),
      status: r.computed_status,
    }));
  }

  getById(id: number) {
    return this.repo.findByIdOrThrow(id);
  }

  create(data: CreateSavingsDto) {
    const id = this.repo.create(data);
    this.repo.createMaturityEvent(id, data.maturity_date, data.principal);
    this.dashboard.upsertSnapshot();

    this.ledger.autoEntry({
      source_module: 'savings',
      source_id: id,
      asset_class_id: LIQUIDITY_ASSET_CLASS_ID,
      institution_id: data.institution_id,
      entry_type: 'savings_deposit',
      description: `Mở sổ tiết kiệm — ${data.label} (${data.instrument_type})`,
      amount: String(-Math.round(parseFloat(data.principal))),
      transaction_date: data.start_date,
      notes: `Lãi suất: ${data.interest_rate}%/năm · Đáo hạn: ${data.maturity_date}`,
    });

    return this.repo.findByIdOrThrow(id);
  }

  update(id: number, data: UpdateSavingsDto) {
    this.repo.findByIdOrThrow(id);
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];

    if (data.institution_id !== undefined) { sets.push('institution_id = ?'); vals.push(data.institution_id); }
    if (data.label !== undefined) { sets.push('label = ?'); vals.push(data.label); }
    if (data.instrument_type !== undefined) { sets.push('instrument_type = ?'); vals.push(data.instrument_type); }
    if (data.principal !== undefined) { sets.push('principal = ?'); vals.push(data.principal); }
    if (data.interest_rate !== undefined) { sets.push('interest_rate = ?'); vals.push(data.interest_rate); }
    if (data.start_date !== undefined) { sets.push('start_date = ?'); vals.push(data.start_date); }
    if (data.maturity_date !== undefined) { sets.push('maturity_date = ?'); vals.push(data.maturity_date); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }

    const updated = this.repo.update(id, sets, vals);
    this.dashboard.upsertSnapshot();
    return updated;
  }

  delete(id: number): { id: number; deleted: boolean } {
    this.repo.findByIdOrThrow(id);
    this.repo.deleteCalendarEvents(id);
    this.repo.delete(id);
    this.ledger.softDeleteAutoEntries('savings', id);
    this.dashboard.upsertSnapshot();
    return { id, deleted: true };
  }
}
