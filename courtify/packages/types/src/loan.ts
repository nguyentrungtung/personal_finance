import { z } from 'zod';

export const LoanSchema = z.object({
  id: z.number(),
  loan_type: z.enum(['lent', 'borrowed']),
  counterparty_name: z.string(),
  description: z.string().nullable(),
  principal: z.string(),
  date_issued: z.string(),
  expected_due_date: z.string(),
  repayment_terms: z.string().nullable(),
  status: z.enum(['active', 'overdue', 'settled']),
  remaining_balance: z.string().optional(), // computed
  created_at: z.string(),
  updated_at: z.string(),
});
export type Loan = z.infer<typeof LoanSchema>;

export const LoanPaymentSchema = z.object({
  id: z.number(),
  loan_id: z.number(),
  scheduled_amount: z.string(),
  due_date: z.string(),
  paid_amount: z.string(),
  paid_date: z.string().nullable(),
  status: z.enum(['scheduled', 'paid', 'overdue']),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LoanPayment = z.infer<typeof LoanPaymentSchema>;
