export interface LoanRow {
  id: number;
  loan_type: string;
  counterparty_name: string;
  principal: string;
  date_issued: string;
  expected_due_date: string;
  repayment_terms: string | null;
  description: string | null;
  interest_rate: string | null;
  interest_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLoanDto {
  loan_type: string;
  counterparty_name: string;
  principal: string;
  date_issued: string;
  expected_due_date: string;
  repayment_terms?: string;
  description?: string;
  interest_rate?: string;
  interest_type?: string;
}

export type UpdateLoanDto = Partial<CreateLoanDto>;

export interface ListLoansParams {
  type?: string;
  status?: string;
  search?: string;
  sort?: string;
  sortDir?: string;
  page?: number;
}
