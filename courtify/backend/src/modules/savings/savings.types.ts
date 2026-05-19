export interface SavingsInstrumentRow {
  id: number;
  institution_id: number;
  label: string;
  instrument_type: string;
  principal: string;
  interest_rate: string;
  start_date: string;
  maturity_date: string;
  status: string;
  institution_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSavingsDto {
  institution_id: number;
  label: string;
  instrument_type: string;
  principal: string;
  interest_rate: string;
  start_date: string;
  maturity_date: string;
}

export type UpdateSavingsDto = Partial<CreateSavingsDto & { status: string }>;

export interface ListSavingsParams {
  search?: string;
  status?: string;
  instrument_type?: string;
  sort?: string;
  sortDir?: string;
  page?: number;
}
