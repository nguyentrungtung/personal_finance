export interface AssetClassRow { id: number; code: string; label: string; }
export interface SnapshotRow {
  snapshot_date: string;
  total_vnd: string;
  metals_vnd: string;
  markets_vnd: string;
  liquidity_vnd: string;
  real_estate_vnd: string;
}
export interface LedgerRow {
  id: number;
  entry_type: string;
  description: string;
  transaction_date: string;
  amount: string;
  status: string;
}
