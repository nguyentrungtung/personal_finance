export interface MetalHoldingRow {
  id: number;
  metal_type: string;
  label: string | null;
  weight_grams: string;
  weight_display: string;
  weight_unit: string;
  purity: string;
  purchase_price_per_gram: string;
  current_price_per_gram: string;
  purchase_date: string;
  institution_id: number | null;
  institution_name: string | null;
  created_at: string;
  updated_at: string;
  purchase_value_raw?: number;
  current_value_raw?: number;
  unrealised_gain_raw?: number;
}

export interface MetalHolding extends MetalHoldingRow {
  purchase_value: string;
  current_value: string;
  unrealised_gain: string;
}

export interface CreateMetalDto {
  metal_type: string;
  label?: string;
  weight_display: number;
  weight_unit: string;
  purity: string;
  purchase_price_per_gram: string;
  current_price_per_gram: string;
  purchase_date: string;
  institution_id?: number;
}

export type UpdateMetalDto = Partial<CreateMetalDto>;
