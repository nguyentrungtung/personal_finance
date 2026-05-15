import { z } from 'zod';

export const AssetClassSchema = z.object({
  id: z.number(),
  code: z.enum(['metals', 'markets', 'liquidity', 'real_estate']),
  label: z.string(),
  icon: z.string().nullable(),
});
export type AssetClass = z.infer<typeof AssetClassSchema>;

export const AssetLotSchema = z.object({
  id: z.number(),
  asset_class_id: z.number(),
  asset_name: z.string(),
  asset_subtype: z.enum(['stock', 'crypto', 'mutual_fund', 'etf']),
  institution_id: z.number().nullable(),
  purchase_date: z.string(),
  original_volume: z.string(),
  remaining_volume: z.string(),
  buy_price_per_unit: z.string(),
  current_price_per_unit: z.string(),
  unit_label: z.string(),
  status: z.enum(['active', 'partial_closed', 'closed']),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  // Computed at query time
  current_value: z.string().optional(),
  unrealised_pnl: z.string().optional(),
  pct_change: z.string().optional(),
});
export type AssetLot = z.infer<typeof AssetLotSchema>;

export const AssetTransactionSchema = z.object({
  id: z.number(),
  lot_id: z.number(),
  transaction_type: z.enum(['buy', 'sell', 'dividend', 'split']),
  transaction_date: z.string(),
  volume: z.string(),
  price_per_unit: z.string(),
  fee: z.string(),
  net_amount: z.string(),
  realized_pnl: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type AssetTransaction = z.infer<typeof AssetTransactionSchema>;
