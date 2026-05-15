import { z } from 'zod';

export const LedgerEntrySchema = z.object({
  id: z.number(),
  asset_class_id: z.number(),
  asset_class_code: z.string().optional(),
  institution_id: z.number().nullable(),
  institution_name: z.string().nullable().optional(),
  entry_type: z.string(),
  description: z.string(),
  amount: z.string(),
  status: z.enum(['completed', 'pending', 'appraisal', 'cleared']),
  transaction_date: z.string(),
  attachment_path: z.string().nullable(),
  notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const LedgerListResponseSchema = z.object({
  rows: z.array(LedgerEntrySchema),
  total_count: z.number(),
  current_page: z.number(),
});
export type LedgerListResponse = z.infer<typeof LedgerListResponseSchema>;
