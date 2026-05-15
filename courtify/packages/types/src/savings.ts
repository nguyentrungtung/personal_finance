import { z } from 'zod';

export const SavingsInstrumentSchema = z.object({
  id: z.number(),
  institution_id: z.number(),
  institution_name: z.string().optional(),
  label: z.string(),
  instrument_type: z.enum(['savings_account', 'certificate_of_deposit', 'money_market', 'treasury_bond']),
  principal: z.string(),
  interest_rate: z.string(),
  start_date: z.string(),
  maturity_date: z.string(),
  status: z.enum(['active', 'matured', 'withdrawn']),
  accrued_interest: z.string().optional(), // computed at query time
  created_at: z.string(),
  updated_at: z.string(),
});
export type SavingsInstrument = z.infer<typeof SavingsInstrumentSchema>;
