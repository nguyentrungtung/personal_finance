export type SourceModule = 'manual' | 'metals' | 'savings' | 'loans' | 'investment';

export interface AutoLedgerParams {
  /** Which module triggered this entry */
  source_module: SourceModule;
  /** PK of the originating record */
  source_id: number;
  /** asset_classes.id */
  asset_class_id: number;
  institution_id?: number;
  /** e.g. 'crypto_purchase', 'savings_deposit', 'loan_repayment', 'other' */
  entry_type: string;
  /** Human-readable label shown in Sổ cái */
  description: string;
  /** Signed VND string: positive = money in, negative = money out */
  amount: string;
  transaction_date: string;
  notes?: string;
}

export interface LedgerEntryRow {
  id: number;
  asset_class_id: number;
  institution_id: number | null;
  entry_type: string;
  description: string;
  amount: string;
  /** completed | pending | appraisal | cleared | voided | reversed */
  status: string;
  transaction_date: string;
  notes: string | null;
  source_module: string | null;
  source_id: number | null;
  is_auto: number;
  deleted_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  /** FK to the original entry that this entry reverses */
  reversal_of: number | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntryVersion {
  id: number;
  entry_id: number;
  version: number;
  snapshot: string;  // JSON
  edit_reason: string | null;
  changed_at: string;
}

export interface ListParams {
  assetClass?: string;
  entryType?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;   // full-text search on description + notes
  includeVoided?: boolean; // default false — voided entries hidden unless explicitly requested
  sort?: string;
  sortDir?: string;
  page?: number;
}
