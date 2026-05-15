import type { InstitutionsRepository } from './institutions.repository.js';
import { NotFoundError, BusinessRuleError } from '../../shared/errors.js';
import type { CreateInstitutionDto, UpdateInstitutionDto } from './institutions.types.js';

export class InstitutionsService {
  constructor(private readonly repo: InstitutionsRepository) {}

  listAll(includeArchived = false, assetClass?: string) {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!includeArchived) {
      conditions.push('archived_at IS NULL');
    }

    if (assetClass) {
      conditions.push('supported_channels LIKE ?');
      params.push(`%"${assetClass}"%`);
    }

    const rows = this.repo.findAll(conditions, params);

    if (includeArchived) {
      return rows.map(i => ({ ...i, display_name: i.archived_at ? `${i.name} (Archived)` : i.name }));
    }
    return rows;
  }

  getById(id: number) {
    const row = this.repo.findById(id);
    if (!row) throw new NotFoundError('Institution', id);
    return row;
  }

  create(data: CreateInstitutionDto) {
    const id = this.repo.create(data);
    return this.getById(id);
  }

  update(id: number, data: UpdateInstitutionDto) {
    this.getById(id);
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
    if (data.type !== undefined) { sets.push('type = ?'); vals.push(data.type); }
    if (data.supported_channels !== undefined) { sets.push('supported_channels = ?'); vals.push(data.supported_channels); }
    this.repo.update(id, sets, vals);
    return this.getById(id);
  }

  archive(id: number) {
    this.getById(id);
    this.repo.archive(id);
    return this.getById(id);
  }

  restore(id: number) {
    this.getById(id);
    this.repo.restore(id);
    return this.getById(id);
  }

  delete(id: number) {
    this.getById(id);

    const refs = [
      { table: 'ledger_entries', col: 'institution_id' },
      { table: 'savings_instruments', col: 'institution_id' },
      { table: 'metals_holdings', col: 'institution_id' },
      { table: 'asset_lots', col: 'institution_id' },
    ];

    for (const { table, col } of refs) {
      const count = this.repo.countReferences(table, col, id);
      if (count > 0) {
        throw new BusinessRuleError(
          `Cannot delete institution referenced by ${table}. Archive it instead.`,
          'FK_REFERENCE',
        );
      }
    }

    this.repo.delete(id);
    return { id, deleted: true };
  }
}
