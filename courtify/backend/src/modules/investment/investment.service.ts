import { BusinessRuleError } from '../../shared/errors.js';
import type { InvestmentRepository } from './investment.repository.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';
import type { ListLotsParams, BuyLotDto, SellDto, FifoLot, FifoMatch } from './investment.types.js';
import { paginate } from '../../shared/pagination.js';

function fifoMatch(lots: FifoLot[], sellVolume: number): FifoMatch[] {
  const sorted = [...lots].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  const totalAvailable = sorted.reduce((s, l) => s + l.remainingVolume, 0);

  if (sellVolume > totalAvailable + 0.000001) {
    throw new BusinessRuleError(
      `Insufficient volume: requested ${sellVolume}, available ${totalAvailable}`,
      'INSUFFICIENT_VOLUME',
    );
  }

  const result: FifoMatch[] = [];
  let remaining = sellVolume;

  for (const lot of sorted) {
    if (remaining <= 0) break;
    const consumed = Math.min(remaining, lot.remainingVolume);
    result.push({
      lotId: lot.id,
      volumeConsumed: consumed,
      lotBuyPrice: lot.buyPricePerUnit,
    });
    remaining -= consumed;
  }

  return result;
}

export class InvestmentService {
  constructor(
    private readonly repo: InvestmentRepository,
    private readonly ledger: LedgerService,
    private readonly dashboard: DashboardService,
  ) {}

  listLots(params: ListLotsParams = {}) {
    const rows = this.repo.findAll(params);
    // aggregated view: no pagination — always a small grouped result set
    if (params.view === 'aggregated') return rows;
    const total_count = this.repo.countFiltered(params);
    return paginate(rows as Record<string, unknown>[], total_count, params.page ?? 1);
  }

  getLotById(id: number) {
    return this.repo.findById(id);
  }

  buyLot(data: BuyLotDto) {
    const lotId = this.repo.dbTransaction(() => {
      const id = this.repo.insertLot(data);
      const volume = parseFloat(data.volume);
      const price = parseFloat(data.buy_price_per_unit);
      const fee = parseFloat(data.fee ?? '0');
      const netAmount = -(volume * price + fee);

      this.repo.insertTransaction({
        lot_id: id,
        transaction_type: 'buy',
        transaction_date: data.purchase_date,
        volume: data.volume,
        price_per_unit: data.buy_price_per_unit,
        fee: String(fee.toFixed(4)),
        net_amount: String(netAmount.toFixed(4)),
        realized_pnl: null,
      });
      return id;
    });

    this.dashboard.upsertSnapshot();

    const volume = parseFloat(data.volume);
    const price = parseFloat(data.buy_price_per_unit);
    const fee = parseFloat(data.fee ?? '0');
    const totalCost = volume * price + fee;
    this.ledger.autoEntry({
      source_module: 'investment',
      source_id: lotId,
      asset_class_id: data.asset_class_id,
      institution_id: data.institution_id,
      entry_type: 'other',
      description: `Mua ${data.asset_name} (${data.asset_subtype}) — ${data.volume} ${data.unit_label ?? 'shares'}`,
      amount: String(-Math.round(totalCost)),
      transaction_date: data.purchase_date,
      notes: data.notes,
    });

    return this.repo.findById(lotId);
  }

  sellLot(data: SellDto) {
    const lots = this.repo.findLotsByAsset(data.asset_name, data.asset_class_id);
    const matches = fifoMatch(lots, data.sell_volume);
    const fee = data.fee ?? 0;
    const transactions: unknown[] = [];

    this.repo.dbTransaction(() => {
      for (const match of matches) {
        const realizedPnl = (data.sell_price - match.lotBuyPrice) * match.volumeConsumed - (fee / matches.length);
        const netAmount = data.sell_price * match.volumeConsumed - (fee / matches.length);

        this.repo.insertTransaction({
          lot_id: match.lotId,
          transaction_type: 'sell',
          transaction_date: data.date,
          volume: String(match.volumeConsumed.toFixed(4)),
          price_per_unit: String(data.sell_price.toFixed(4)),
          fee: String((fee / matches.length).toFixed(4)),
          net_amount: String(netAmount.toFixed(4)),
          realized_pnl: String(realizedPnl.toFixed(4)),
        });

        const lot = this.repo.getLotById(match.lotId) as Record<string, unknown>;
        const newRemaining = parseFloat(lot.remaining_volume as string) - match.volumeConsumed;
        const newStatus = newRemaining <= 0.000001 ? 'closed' : 'partial_closed';

        this.repo.updateLotVolume(match.lotId, String(Math.max(0, newRemaining).toFixed(4)), newStatus);

        transactions.push({ lotId: match.lotId, volumeConsumed: match.volumeConsumed, realizedPnl });
      }
    });

    this.dashboard.upsertSnapshot();

    const totalNetAmount = data.sell_volume * data.sell_price - fee;
    const firstLot = lots[0];
    if (firstLot) {
      const assetClassId = this.repo.getLotAssetClassId(firstLot.id);
      if (assetClassId) {
        this.ledger.autoEntry({
          source_module: 'investment',
          source_id: firstLot.id,
          asset_class_id: data.asset_class_id ?? assetClassId,
          entry_type: 'other',
          description: `Bán ${data.asset_name} — ${data.sell_volume} units`,
          amount: String(Math.round(totalNetAmount)),
          transaction_date: data.date,
        });
      }
    }

    return { matches: transactions };
  }

  updateLotPrice(lotId: number, newPrice: string) {
    this.repo.findById(lotId);
    this.repo.updateLotPrice(lotId, newPrice);
    this.dashboard.upsertSnapshot();
    return this.repo.findById(lotId);
  }

  listTradeHistory(params: { assetClass?: string; dateFrom?: string; dateTo?: string; }) {
    return this.repo.getTradeHistory(params);
  }
}
