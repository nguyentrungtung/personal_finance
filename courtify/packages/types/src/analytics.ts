import { z } from 'zod';

export const NetWorthSnapshotSchema = z.object({
  id: z.number(),
  snapshot_date: z.string(),
  total_vnd: z.string(),
  metals_vnd: z.string(),
  markets_vnd: z.string(),
  liquidity_vnd: z.string(),
  real_estate_vnd: z.string(),
  created_at: z.string(),
});
export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshotSchema>;

export const PnLSummarySchema = z.object({
  total_realized_pnl: z.string(),
  by_class: z.array(
    z.object({
      asset_class: z.string(),
      realized_pnl: z.string(),
    })
  ),
});
export type PnLSummary = z.infer<typeof PnLSummarySchema>;

export const ProjectedPointSchema = z.object({
  date: z.string(),
  projected_total: z.string(),
});
export type ProjectedPoint = z.infer<typeof ProjectedPointSchema>;
