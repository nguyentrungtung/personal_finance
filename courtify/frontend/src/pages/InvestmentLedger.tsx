import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { abbreviateVND, formatVND } from '../lib/vnd';
import { EmptyState } from '../components/shared/EmptyState';
import { VNDInput } from '../components/shared/VNDInput';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lot {
  id: number;
  asset_name: string;
  asset_subtype: string;
  asset_class_code: string;
  institution_name?: string;
  purchase_date: string;
  remaining_volume: string;
  original_volume: string;
  buy_price_per_unit: string;
  current_price_per_unit: string;
  unit_label: string;
  status: string;
  current_value: number;
  unrealised_pnl: number;
  pct_change: number;
}

interface AggregatedLot {
  asset_name: string;
  asset_subtype: string;
  asset_class_code: string;
  unit_label: string;
  total_remaining_volume: number;
  weighted_avg_cost: number;
  current_price_per_unit: number;
  total_current_value: number;
  blended_pct_change: number;
}

interface TradeHistory {
  id: number;
  lot_id: number;
  asset_name: string;
  asset_class_code: string;
  transaction_date: string;
  volume: string;
  price_per_unit: string;
  lot_buy_price: string;
  realized_pnl: string;
  fee: string;
}

interface Institution {
  id: number;
  name: string;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'markets', assetClass: 'markets' },
  { key: 'metals', assetClass: 'metals' },
  { key: 'liquidity', assetClass: 'liquidity' },
  { key: 'real_estate', assetClass: 'real_estate' },
] as const;

const ASSET_CLASS_ID_MAP: Record<string, number> = {
  metals: 1, markets: 2, liquidity: 3, real_estate: 4,
};

// ─── Per-tab form config (labels / placeholders / hints) ──────────────────────
// All fields map to the same DB columns — only UX context changes per tab.

interface TabFormConfig {
  icon: string;
  assetNameLabel: string;
  assetNamePlaceholder: string;
  subtypeLabel: string;
  institutionLabel: string;
  volumeLabel: string;
  volumePlaceholder: string;
  buyPriceLabel: string;
  currentPriceLabel: string;
  unitPlaceholder: string;
  defaultSubtype: string;
  hint: string;
}

const TAB_FORM_CONFIG: Record<string, TabFormConfig> = {
  markets: {
    icon: '📈',
    assetNameLabel: 'Ticker / Asset Name',
    assetNamePlaceholder: 'e.g. BTC, FPT, VNM',
    subtypeLabel: 'Asset Type',
    institutionLabel: 'Exchange / Brokerage',
    volumeLabel: 'Quantity',
    volumePlaceholder: '0',
    buyPriceLabel: 'Buy Price / unit (VND)',
    currentPriceLabel: 'Current Market Price (VND)',
    unitPlaceholder: 'shares, coin',
    defaultSubtype: 'stock',
    hint: 'Record a stock, crypto, ETF or mutual fund purchase lot.',
  },
  metals: {
    icon: '🥇',
    assetNameLabel: 'Metal / Label',
    assetNamePlaceholder: 'e.g. SJC Gold, Bạc 999',
    subtypeLabel: 'Metal Type',
    institutionLabel: 'Dealer / Store',
    volumeLabel: 'Weight',
    volumePlaceholder: '0',
    buyPriceLabel: 'Purchase Price / gram (VND)',
    currentPriceLabel: 'Current Price / gram (VND)',
    unitPlaceholder: 'chỉ, lượng, gram',
    defaultSubtype: 'gold',
    hint: 'Track a gold or silver holding. Enter weight and price per gram.',
  },
  liquidity: {
    icon: '💰',
    assetNameLabel: 'Fund / Account Name',
    assetNamePlaceholder: 'e.g. TCBF, VinaCapital Growth',
    subtypeLabel: 'Fund Type',
    institutionLabel: 'Fund House / Bank',
    volumeLabel: 'Units / Certificates',
    volumePlaceholder: '0',
    buyPriceLabel: 'Buy NAV / unit (VND)',
    currentPriceLabel: 'Current NAV / unit (VND)',
    unitPlaceholder: 'CCQ, unit',
    defaultSubtype: 'mutual_fund',
    hint: 'Track a mutual fund, savings bond or liquidity position.',
  },
  real_estate: {
    icon: '🏢',
    assetNameLabel: 'Property / Address',
    assetNamePlaceholder: 'e.g. Căn 2PN Q.7, Lô đất Bình Dương',
    subtypeLabel: 'Property Type',
    institutionLabel: 'Agent / Bank',
    volumeLabel: 'Area / Lots',
    volumePlaceholder: '0',
    buyPriceLabel: 'Purchase Price (VND)',
    currentPriceLabel: 'Current Valuation (VND)',
    unitPlaceholder: 'm², lô',
    defaultSubtype: 'real_estate',
    hint: 'Record a real estate asset. Use area or unit count as volume.',
  },
};



interface SellFormConfig {
  volumeLabel: string;
  volumePlaceholder: string;
  priceLabel: string;
  pricePlaceholder: string;
  actionLabel: string;
  hint: string;
}

const SELL_CONFIG: Record<string, SellFormConfig> = {
  markets: {
    volumeLabel: 'Số lượng bán',
    volumePlaceholder: '0',
    priceLabel: 'Giá bán / đơn vị (VND)',
    pricePlaceholder: '0',
    actionLabel: 'Xác nhận bán',
    hint: 'Hệ thống sẽ tự động khớp lô theo phương pháp FIFO (lô mua trước bán trước).',
  },
  metals: {
    volumeLabel: 'Khối lượng bán',
    volumePlaceholder: '0',
    priceLabel: 'Giá bán / gram (VND)',
    pricePlaceholder: '0',
    actionLabel: 'Xác nhận bán',
    hint: 'Nhập khối lượng và giá bán theo cùng đơn vị đã mua.',
  },
  liquidity: {
    volumeLabel: 'Số CCQ / đơn vị rút',
    volumePlaceholder: '0',
    priceLabel: 'NAV / đơn vị (VND)',
    pricePlaceholder: '0',
    actionLabel: 'Xác nhận rút',
    hint: 'Ghi nhận việc rút vốn hoặc đáo hạn quỹ. Lãi/lỗ sẽ được tính tự động.',
  },
  real_estate: {
    volumeLabel: 'Diện tích / Số lô bán',
    volumePlaceholder: '0',
    priceLabel: 'Giá bán (VND)',
    pricePlaceholder: '0',
    actionLabel: 'Xác nhận chuyển nhượng',
    hint: 'Ghi nhận giao dịch chuyển nhượng bất động sản. Nhập tổng giá trị giao dịch.',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function InvestmentLedger() {
  const { t } = useTranslation();
  const { success, error: toastError } = useToast();

  // ─── Schemas ─────────────────────────────────────────────────────────────────
  const BuySchema = z.object({
    asset_class_id: z.coerce.number().int().positive(t('investmentLedger.errors.required')),
    asset_name: z.string().min(1, t('investmentLedger.errors.required')),
    asset_subtype: z.enum(['stock', 'crypto', 'mutual_fund', 'etf', 'gold', 'silver', 'real_estate', 'other']),
    institution_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.literal(0), z.nan()]).optional().transform(v => typeof v === 'number' && v > 0 ? v : undefined),
    purchase_date: z.string().min(1, t('investmentLedger.errors.required')),
    volume: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    buy_price_per_unit: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    current_price_per_unit: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    unit_label: z.string().optional().transform(v => v === '' ? undefined : v),
    fee: z.string().optional().transform(v => v === '' ? undefined : v),
    notes: z.string().optional().transform(v => v === '' ? undefined : v),
  });

  const SellSchema = z.object({
    asset_name: z.string().min(1, t('investmentLedger.errors.required')),
    asset_class_id: z.coerce.number().int().positive().optional(),
    sell_volume: z.coerce.number().positive(t('investmentLedger.errors.mustBePositive')),
    sell_price: z.coerce.number().positive(t('investmentLedger.errors.mustBePositive')),
    fee: z.union([z.coerce.number().min(0), z.literal(''), z.nan()]).optional().transform(v => typeof v === 'number' && v >= 0 ? v : undefined),
    date: z.string().min(1, t('investmentLedger.errors.required')),
  });

  type BuyForm = z.infer<typeof BuySchema>;
  type SellForm = z.infer<typeof SellSchema>;

  const [activeTab, setActiveTab] = useState<string>('markets');
  const [viewMode, setViewMode] = useState<'lot' | 'aggregated'>('lot');
  const [showHistory, setShowHistory] = useState(false);
  const [lots, setLots] = useState<Lot[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedLot[]>([]);
  const [history, setHistory] = useState<TradeHistory[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [subtypes, setSubtypes] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Sell modal state ──────────────────────────────────────────────────────
  const [selectedSellAsset, setSelectedSellAsset] = useState<string>('');
  const [sellPricePreview, setSellPricePreview] = useState<number>(0);
  const [sellVolumePreview, setSellVolumePreview] = useState<number>(0);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<BuyForm>({
    resolver: zodResolver(BuySchema),
    defaultValues: { asset_subtype: 'stock' },
  });

  const sellForm = useForm<SellForm>({ resolver: zodResolver(SellSchema) });

  const currentTab = TABS.find(t => t.key === activeTab)!;
  const tabCfg = TAB_FORM_CONFIG[activeTab] ?? TAB_FORM_CONFIG.markets;;

  const sellCfg = SELL_CONFIG[activeTab] ?? SELL_CONFIG.markets;

  // Unique asset names available for selling in current tab
  const sellableAssets = Array.from(
    new Map(
      lots
        .filter(l => parseFloat(l.remaining_volume) > 0)
        .map(l => [l.asset_name, l])
    ).values()
  );

  // Selected asset info for P&L preview
  const selectedLots = lots.filter(l => l.asset_name === selectedSellAsset && parseFloat(l.remaining_volume) > 0);
  const totalRemaining = selectedLots.reduce((s, l) => s + parseFloat(l.remaining_volume), 0);
  const avgCost = selectedLots.length > 0
    ? selectedLots.reduce((s, l) => s + parseFloat(l.buy_price_per_unit) * parseFloat(l.remaining_volume), 0) / totalRemaining
    : 0;
  const previewPnl = sellVolumePreview > 0 && sellPricePreview > 0
    ? (sellPricePreview - avgCost) * sellVolumePreview
    : null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lotRes, aggRes, histRes, instRes, settingsRes] = await Promise.all([
        apiFetch<{ data: Lot[] }>(`/api/v1/lots?asset_class=${currentTab.assetClass}&view=lot`),
        apiFetch<{ data: AggregatedLot[] }>(`/api/v1/lots?asset_class=${currentTab.assetClass}&view=aggregated`),
        apiFetch<{ data: TradeHistory[] }>(`/api/v1/lots/history?asset_class=${currentTab.assetClass}`),
        apiFetch<{ data: Institution[] }>(`/api/v1/institutions?asset_class=${currentTab.assetClass}`),
        apiFetch<{ data: { asset_subtypes_config?: string } }>('/api/v1/settings'),
      ]);
      setLots(lotRes.data ?? []);
      setAggregated(aggRes.data ?? []);
      setHistory(histRes.data ?? []);
      setInstitutions(instRes.data ?? []);

      const configStr = settingsRes.data?.asset_subtypes_config;
      if (configStr) {
        try {
          setSubtypes(JSON.parse(configStr));
        } catch {
          // fallback empty
        }
      }

    } catch (e) {
      setError(t('common.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentTab.assetClass, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset view + form defaults when changing tabs
  useEffect(() => {
    setViewMode('lot');
    setShowHistory(false);
    setValue('asset_subtype', TAB_FORM_CONFIG[activeTab]?.defaultSubtype as BuyForm['asset_subtype'] ?? 'stock');
    setValue('asset_class_id', ASSET_CLASS_ID_MAP[activeTab] ?? 2);
  }, [activeTab, setValue]);

  const onBuySubmit = handleSubmit(async (data) => {
    try {
      setError(null);
      await apiFetch('/api/v1/lots', {
        method: 'POST', body: {
          ...data,
          asset_class_id: ASSET_CLASS_ID_MAP[currentTab.assetClass] ?? data.asset_class_id,
        }
      });
      success(t('investmentLedger.addInvestment'), { message: 'Investment recorded.' });
      setShowBuyModal(false);
      reset();
      fetchData();
    } catch (e: unknown) {
      setError((e as Error).message ?? t('common.error'));
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  const onSellSubmit = sellForm.handleSubmit(async (data) => {
    try {
      setError(null);
      await apiFetch('/api/v1/lots/sell', {
        method: 'POST',
        body: { ...data, asset_class_id: ASSET_CLASS_ID_MAP[activeTab] ?? data.asset_class_id },
      });
      success(t('investmentLedger.recordSell'), { message: 'Sell recorded.' });
      setShowSellModal(false);
      sellForm.reset();
      setSelectedSellAsset('');
      setSellPricePreview(0);
      setSellVolumePreview(0);
      fetchData();
    } catch (e: unknown) {
      setError((e as Error).message ?? t('investmentLedger.errors.sellFailed'));
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  const handlePriceUpdate = async (id: number) => {
    if (!priceInput) { setEditingPrice(null); return; }
    const formatted = parseFloat(priceInput).toFixed(4);
    await apiFetch(`/api/v1/lots/${id}/price`, {
      method: 'PATCH',
      body: { current_price_per_unit: formatted },
    });
    setEditingPrice(null);
    fetchData();
  };

  const totalCurrentValue = lots.reduce((s, l) => s + (l.current_value ?? 0), 0);
  const totalPnl = lots.reduce((s, l) => s + (l.unrealised_pnl ?? 0), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('investmentLedger.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('investmentLedger.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-400">{t('investmentLedger.portfolioValue')}</div>
              <div className="text-lg font-bold text-white">{abbreviateVND(totalCurrentValue)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">{t('investmentLedger.unrealizedPL')}</div>
              <div className={`text-lg font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}{abbreviateVND(Math.abs(totalPnl))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setShowSellModal(true);
                sellForm.reset();
                setSelectedSellAsset('');
                setSellPricePreview(0);
                setSellVolumePreview(0);
              }}
              className="flex-1 sm:flex-none px-4 py-2 text-sm border border-amber-600 text-amber-400 hover:bg-amber-900/30 rounded-lg font-medium"
            >
              {t('investmentLedger.recordSell')}
            </button>
            <button
              onClick={() => { setShowBuyModal(true); reset(); setValue('asset_class_id', ASSET_CLASS_ID_MAP[currentTab.assetClass] ?? 2); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {t('investmentLedger.addInvestment')}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Asset class tabs */}
      <div className="flex gap-1 border-b border-[#222]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.key
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-gray-400 hover:text-white'
              }`}
          >
            {t(`investmentLedger.tabs.${tab.key}` as any)}
          </button>
        ))}
      </div>

      {/* View controls + guide card */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
        {/* Guide card - moved to top on mobile */}
        <div className="order-1 lg:order-2 flex-1 w-full lg:max-w-2xl bg-[#0f1a12] border border-green-900/40 rounded-xl px-4 py-3 text-xs text-gray-400 space-y-1.5">
          {!showHistory && viewMode === 'lot' && (
            <div>
              <span className="text-green-400 font-semibold">📋 Xem theo lô: </span>
              Mỗi hàng là một lần mua riêng biệt (một "lô"). Giúp theo dõi giá vốn chính xác từng đợt mua — đặc biệt hữu ích khi bạn mua nhiều lần (DCA). Nhấn vào <span className="text-green-400">Giá hiện tại</span> để cập nhật giá thị trường. Nhấn <span className="text-amber-400">Ghi nhận bán</span> để ghi nhận lô đã bán.
            </div>
          )}
          {!showHistory && viewMode === 'aggregated' && (
            <div>
              <span className="text-green-400 font-semibold">📊 Xem tổng hợp: </span>
              Gộp tất cả lô của cùng một mã tài sản thành một hàng. Hiển thị <span className="text-white">giá vốn bình quân</span> (weighted avg cost) và tổng giá trị hiện tại. Phù hợp để nắm bức tranh toàn cảnh danh mục.
            </div>
          )}
          {showHistory && (
            <div>
              <span className="text-green-400 font-semibold">📈 Lịch sử giao dịch: </span>
              Hiển thị các giao dịch <span className="text-white">bán đã thực hiện</span> — bao gồm giá bán, giá vốn gốc và <span className="text-green-400">lãi/lỗ đã chốt</span>. Lãi/lỗ chưa thực hiện (vẫn đang nắm giữ) xem ở tab "Xem theo lô".
            </div>
          )}
        </div>

        <div className="order-2 lg:order-1 flex gap-1 bg-[#1a1a1a] rounded-lg p-1 w-full sm:w-auto">
          <button
            onClick={() => { setViewMode('lot'); setShowHistory(false); }}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'lot' && !showHistory ? 'bg-[#2a2a2a] text-white' : 'text-gray-400'
              }`}
            title="Xem từng lô mua riêng biệt — theo dõi giá vốn từng lần mua"
          >
            {t('investmentLedger.views.lot')}
          </button>
          <button
            onClick={() => { setViewMode('aggregated'); setShowHistory(false); }}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'aggregated' && !showHistory ? 'bg-[#2a2a2a] text-white' : 'text-gray-400'
              }`}
            title="Gộp tất cả lô của cùng một tài sản — xem tổng vị thế & giá vốn bình quân"
          >
            {t('investmentLedger.views.aggregated')}
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition-colors ${showHistory ? 'bg-[#2a2a2a] text-white' : 'text-gray-400'
              }`}
            title="Xem lịch sử giao dịch bán — lãi/lỗ đã thực hiện"
          >
            {t('investmentLedger.views.history')}
          </button>
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[#111] rounded-lg animate-pulse" />)}
        </div>
      ) : showHistory ? (
        /* Trade History */
        history.length === 0 ? (
          <EmptyState title={t('investmentLedger.noHistory')} description={t('investmentLedger.noHistoryDesc')} />
        ) : (
          <div className="table-container bg-[#111] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-[#222] text-gray-400 text-xs uppercase tracking-widest">
                  <th className="px-4 py-3 text-left">{t('investmentLedger.table.date')}</th>
                  <th className="px-4 py-3 text-left">{t('investmentLedger.table.asset')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.volume')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.sellPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.costPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.realizedPL')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const pnl = parseFloat(h.realized_pnl ?? '0');
                  return (
                    <tr key={h.id} className="border-b border-[#1a1a1a] hover:bg-[#161616]">
                      <td className="px-4 py-3 text-gray-300">{h.transaction_date}</td>
                      <td className="px-4 py-3 text-white font-medium">{h.asset_name}</td>
                      <td className="px-4 py-3 text-right text-gray-200 font-mono">{h.volume}</td>
                      <td className="px-4 py-3 text-right text-gray-200 font-mono">{formatVND(parseFloat(h.price_per_unit))}</td>
                      <td className="px-4 py-3 text-right text-gray-400 font-mono">{formatVND(parseFloat(h.lot_buy_price))}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{abbreviateVND(Math.abs(pnl))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : viewMode === 'aggregated' ? (
        /* Aggregated view */
        aggregated.length === 0 ? (
          <EmptyState
            title={t('investmentLedger.noPositions')}
            description={t('investmentLedger.noPositionsDesc', { label: t(`investmentLedger.tabs.${activeTab}` as any) })}
            action={{ label: t('investmentLedger.addInvestment'), onClick: () => setShowBuyModal(true) }}
          />
        ) : (
          <div className="table-container bg-[#111] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-[#222] text-gray-400 text-xs uppercase tracking-widest">
                  <th className="px-4 py-3 text-left">{t('investmentLedger.table.asset')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.totalVolume')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.avgCost')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.currentPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.totalValue')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.pctChange')}</th>
                </tr>
              </thead>
              <tbody>
                {aggregated.map(row => {
                  const pct = row.blended_pct_change;
                  return (
                    <tr key={row.asset_name} className="border-b border-[#1a1a1a] hover:bg-[#161616]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{row.asset_name}</div>
                        <div className="text-xs text-gray-500">
                          {t(`enums.assetSubtypes.${row.asset_subtype}` as any, { defaultValue: row.asset_subtype })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-200 font-mono">
                        {row.total_remaining_volume.toFixed(4)} {row.unit_label}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">
                        {formatVND(row.weighted_avg_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono">
                        {formatVND(row.current_price_per_unit)}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-semibold font-mono">
                        {abbreviateVND(row.total_current_value)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Lot view */
        lots.length === 0 ? (
          <EmptyState
            title={t('investmentLedger.noLots')}
            description={t('investmentLedger.noLotsDesc', { label: t(`investmentLedger.tabs.${activeTab}` as any) })}
            action={{ label: t('investmentLedger.addInvestment'), onClick: () => setShowBuyModal(true) }}
          />
        ) : (
          <div className="table-container bg-[#111] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-[#222] text-gray-400 text-xs uppercase tracking-widest">
                  <th className="px-4 py-3 text-left">{t('investmentLedger.table.asset')}</th>
                  <th className="px-4 py-3 text-left">{t('investmentLedger.table.purchaseDate')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.buyPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.currentPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.volume')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.currentValue')}</th>
                  <th className="px-4 py-3 text-right">{t('investmentLedger.table.pctChange')}</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => {
                  const pct = lot.pct_change;
                  return (
                    <tr key={lot.id} className="border-b border-[#1a1a1a] hover:bg-[#161616]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{lot.asset_name}</div>
                        <div className="text-xs text-gray-500">
                          {t(`enums.assetSubtypes.${lot.asset_subtype}` as any, { defaultValue: lot.asset_subtype })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{lot.purchase_date}</td>
                      <td className="px-4 py-3 text-right text-gray-400 font-mono">
                        {formatVND(parseFloat(lot.buy_price_per_unit))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingPrice === lot.id ? (
                          <VNDInput
                            className="w-32 bg-[#1a1a1a] border border-green-600 rounded px-2 py-1 text-sm text-white text-right focus:outline-none"
                            autoFocus
                            value={priceInput}
                            onChange={v => setPriceInput(v)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handlePriceUpdate(lot.id);
                              if (e.key === 'Escape') setEditingPrice(null);
                            }}
                            onBlur={() => handlePriceUpdate(lot.id)}
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingPrice(lot.id); setPriceInput(lot.current_price_per_unit); }}
                            className="text-white font-mono hover:text-green-400 transition-colors"
                            title="Click to edit current price"
                          >
                            {formatVND(parseFloat(lot.current_price_per_unit))}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-200 font-mono">
                        {parseFloat(lot.remaining_volume).toFixed(4)} {lot.unit_label}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-semibold font-mono">
                        {abbreviateVND(lot.current_value)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Buy Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{tabCfg.icon}</span>
                <h2 className="text-lg font-bold text-white">
                  {t('investmentLedger.modals.newEntry', { label: t(`investmentLedger.tabs.${activeTab}` as any) })}
                </h2>
              </div>
              <button onClick={() => { setShowBuyModal(false); reset(); }} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <p className="text-xs text-gray-500 mb-4 border-l-2 border-green-600/40 pl-2">{tabCfg.hint}</p>
            <form onSubmit={onBuySubmit} className="space-y-4">
              <input type="hidden" {...register('asset_class_id', { valueAsNumber: true })} />

              {/* Asset name + subtype */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{tabCfg.assetNameLabel}</label>
                  <input {...register('asset_name')} placeholder={tabCfg.assetNamePlaceholder}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600" />
                  {errors.asset_name && <p className="text-red-400 text-xs mt-1">{errors.asset_name.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{tabCfg.subtypeLabel}</label>
                  <select {...register('asset_subtype')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600">
                    {(subtypes[activeTab] ?? [tabCfg.defaultSubtype]).map(s => (
                      <option key={s} value={s}>
                        {t(`enums.assetSubtypes.${s}` as any, { defaultValue: s })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Institution */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{tabCfg.institutionLabel}</label>
                <select {...register('institution_id', { valueAsNumber: true })}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600">
                  <option value="">{t('investmentLedger.modals.selectInstitution')}</option>
                  {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              {/* Date + Buy price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('investmentLedger.modals.purchaseDate')}</label>
                  <input type="date" {...register('purchase_date')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{tabCfg.buyPriceLabel}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('buy_price_per_unit', v)}
                    value={watch('buy_price_per_unit')}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.buy_price_per_unit && <p className="text-red-400 text-xs mt-1">{errors.buy_price_per_unit.message}</p>}
                </div>
              </div>

              {/* Volume + Fee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{tabCfg.volumeLabel}</label>
                  <input {...register('volume')} type="number" step="0.0001" placeholder={tabCfg.volumePlaceholder}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                  {errors.volume && <p className="text-red-400 text-xs mt-1">{errors.volume.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('investmentLedger.modals.fee')}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('fee', v)}
                    value={watch('fee')}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                </div>
              </div>

              {/* Current price + Unit label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{tabCfg.currentPriceLabel}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('current_price_per_unit', v)}
                    value={watch('current_price_per_unit')}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.current_price_per_unit && <p className="text-red-400 text-xs mt-1">{errors.current_price_per_unit.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('investmentLedger.modals.unitLabel')}</label>
                  <input {...register('unit_label')} placeholder={tabCfg.unitPlaceholder}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('investmentLedger.modals.notes')}</label>
                <textarea {...register('notes')} rows={2} placeholder="..."
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600 resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowBuyModal(false); reset(); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button type="submit"
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2 rounded-lg text-sm">
                  {t('investmentLedger.modals.addToLedger')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sell Modal — per-channel config */}
      {showSellModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{TAB_FORM_CONFIG[activeTab]?.icon ?? '💰'}</span>
                <h2 className="text-lg font-bold text-white">{t('investmentLedger.modals.recordSell')}</h2>
              </div>
              <button
                onClick={() => { setShowSellModal(false); setError(null); setSelectedSellAsset(''); setSellPricePreview(0); setSellVolumePreview(0); }}
                className="text-gray-400 hover:text-white text-xl"
              >×</button>
            </div>
            <p className="text-xs text-gray-500 mb-4 border-l-2 border-amber-600/40 pl-2">{sellCfg.hint}</p>

            <form onSubmit={onSellSubmit} className="space-y-3">
              {/* Asset selector — dropdown from current lots */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">
                  {t('investmentLedger.modals.assetName')}
                </label>
                {sellableAssets.length > 0 ? (
                  <select
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-600"
                    value={selectedSellAsset}
                    onChange={e => {
                      setSelectedSellAsset(e.target.value);
                      sellForm.setValue('asset_name', e.target.value);
                    }}
                  >
                    <option value="">{t('ledger.select')}</option>
                    {sellableAssets.map(l => (
                      <option key={l.asset_name} value={l.asset_name}>
                        {l.asset_name} — còn {parseFloat(l.remaining_volume).toFixed(4)} {l.unit_label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...sellForm.register('asset_name')}
                    placeholder={t('investmentLedger.modals.assetNamePlaceholder')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-600"
                  />
                )}
                {sellForm.formState.errors.asset_name && (
                  <p className="text-red-400 text-xs mt-1">{sellForm.formState.errors.asset_name.message}</p>
                )}
              </div>

              {/* Selected asset info card */}
              {selectedSellAsset && selectedLots.length > 0 && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-xs space-y-1">
                  <div className="flex justify-between text-gray-400">
                    <span>Còn lại:</span>
                    <span className="text-white font-mono">{totalRemaining.toFixed(4)} {selectedLots[0]?.unit_label}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Giá vốn bình quân:</span>
                    <span className="text-white font-mono">{avgCost.toLocaleString('vi-VN')} ₫</span>
                  </div>
                </div>
              )}

              {/* Volume + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">
                    {sellCfg.volumeLabel}
                  </label>
                  <input
                    {...sellForm.register('sell_volume', { valueAsNumber: true })}
                    type="number"
                    step="0.0001"
                    placeholder={sellCfg.volumePlaceholder}
                    onChange={e => {
                      sellForm.setValue('sell_volume', parseFloat(e.target.value) || 0);
                      setSellVolumePreview(parseFloat(e.target.value) || 0);
                    }}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-600"
                  />
                  {sellForm.formState.errors.sell_volume && (
                    <p className="text-red-400 text-xs mt-1">{sellForm.formState.errors.sell_volume.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">
                    {sellCfg.priceLabel}
                  </label>
                  <VNDInput
                    onChange={(v: string) => {
                      sellForm.setValue('sell_price', Number(v));
                      setSellPricePreview(Number(v) || 0);
                    }}
                    value={String(sellForm.watch('sell_price') || '')}
                    placeholder={sellCfg.pricePlaceholder}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-600"
                  />
                  {sellForm.formState.errors.sell_price && (
                    <p className="text-red-400 text-xs mt-1">{sellForm.formState.errors.sell_price.message}</p>
                  )}
                </div>
              </div>

              {/* Fee + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">
                    {t('investmentLedger.modals.fee')}
                  </label>
                  <VNDInput
                    onChange={(v: string) => sellForm.setValue('fee', Number(v))}
                    value={String(sellForm.watch('fee') || '')}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">
                    {t('investmentLedger.modals.sellDate')}
                  </label>
                  <input
                    type="date"
                    {...sellForm.register('date')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-600"
                  />
                  {sellForm.formState.errors.date && (
                    <p className="text-red-400 text-xs mt-1">{sellForm.formState.errors.date.message}</p>
                  )}
                </div>
              </div>

              {/* P&L Preview */}
              {previewPnl !== null && (
                <div className={`rounded-lg px-3 py-2.5 text-xs border ${previewPnl >= 0 ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                  <div className="flex justify-between">
                    <span>Lãi / Lỗ dự kiến:</span>
                    <span className="font-mono font-semibold">
                      {previewPnl >= 0 ? '+' : ''}{Math.round(previewPnl).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400 mt-0.5">
                    <span>Tổng thu về (trước phí):</span>
                    <span className="font-mono">{Math.round(sellPricePreview * sellVolumePreview).toLocaleString('vi-VN')} ₫</span>
                  </div>
                </div>
              )}

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowSellModal(false); setError(null); setSelectedSellAsset(''); setSellPricePreview(0); setSellVolumePreview(0); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 rounded-lg text-sm"
                >
                  {sellCfg.actionLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
