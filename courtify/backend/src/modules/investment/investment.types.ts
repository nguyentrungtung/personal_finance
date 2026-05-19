export interface ListLotsParams {
  assetClass?: string;
  subtype?: string;
  view?: 'lot' | 'aggregated';
  search?: string;
  sort?: string;
  sortDir?: string;
  page?: number;
}

export interface BuyLotDto {
  asset_class_id: number;
  asset_name: string;
  asset_subtype: string;
  institution_id?: number;
  purchase_date: string;
  volume: string;
  buy_price_per_unit: string;
  current_price_per_unit: string;
  unit_label?: string;
  fee?: string;
  notes?: string;
}

export interface SellDto {
  asset_name: string;
  asset_class_id?: number;
  sell_volume: number;
  sell_price: number;
  fee?: number;
  date: string;
}

export interface FifoLot {
  id: number;
  remainingVolume: number;
  buyPricePerUnit: number;
  purchaseDate: string;
}

export interface FifoMatch {
  lotId: number;
  volumeConsumed: number;
  lotBuyPrice: number;
}
