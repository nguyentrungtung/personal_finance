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

interface Institution {
  id: number;
  name: string;
}

interface MetalHolding {
  id: number;
  metal_type: string;
  label?: string;
  weight_grams: string;
  weight_display: string;
  weight_unit: string;
  purity: string;
  purchase_price_per_gram: string;
  current_price_per_gram: string;
  purchase_date: string;
  institution_id?: number;
  institution_name?: string;
  purchase_value: string;
  current_value: string;
  unrealised_gain: string;
}

export default function Metals() {
  const { t } = useTranslation();
  const { success, error: toastError } = useToast();

  const WEIGHT_UNIT_LABELS: Record<string, string> = { chi: 'Chỉ', luong: 'Lượng', gram: 'Gram' };

  const MetalSchema = z.object({
    metal_type: z.enum(['gold', 'silver']),
    label: z.string().optional().transform(v => v === '' ? undefined : v),
    weight_display: z.coerce.number().positive(t('investmentLedger.errors.mustBePositive')),
    weight_unit: z.enum(['chi', 'luong', 'gram']),
    purity: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    purchase_price_per_gram: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    current_price_per_gram: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    purchase_date: z.string().min(1, t('investmentLedger.errors.required')),
    institution_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.literal(0), z.nan()]).optional().transform(v => typeof v === 'number' && v > 0 ? v : undefined),
  });

  type MetalForm = z.infer<typeof MetalSchema>;
  const [holdings, setHoldings] = useState<MetalHolding[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<MetalForm>({
    resolver: zodResolver(MetalSchema),
    defaultValues: { metal_type: 'gold', weight_unit: 'chi' },
  });

  const metalType = watch('metal_type');
  const weightUnit = watch('weight_unit');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [holdRes, instRes] = await Promise.all([
        apiFetch<{ data: MetalHolding[] }>('/api/v1/metals'),
        apiFetch<{ data: Institution[] }>('/api/v1/institutions'),
      ]);
      setHoldings(holdRes.data ?? []);
      setInstitutions(instRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalCurrentValue = holdings.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const totalGain = holdings.reduce((s, h) => s + parseFloat(h.unrealised_gain), 0);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await apiFetch('/api/v1/metals', { method: 'POST', body: data });
      success(t('metals.modals.addTitle'), { message: 'Entry saved successfully.' });
      setShowModal(false);
      reset();
      fetchAll();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/v1/metals/${id}`, { method: 'DELETE' });
      success('Deleted', { message: 'Metal holding removed.' });
      setDeleteConfirm(null);
      fetchAll();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  const handlePriceEdit = async (id: number) => {
    if (!priceInput) return;
    const formatted = parseFloat(priceInput).toFixed(4);
    try {
      await apiFetch(`/api/v1/metals/${id}`, {
        method: 'PUT',
        body: { current_price_per_gram: formatted },
      });
      setEditingPrice(null);
      fetchAll();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('metals.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('metals.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right flex-1 lg:flex-none">
            <div className="text-xs text-gray-400">{t('metals.totalValue')}</div>
            <div className="text-lg font-bold text-white">{abbreviateVND(totalCurrentValue)}</div>
          </div>
          <div className="text-right flex-1 lg:flex-none">
            <div className="text-xs text-gray-400">{t('metals.unrealisedGain')}</div>
            <div className={`text-lg font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalGain >= 0 ? '+' : ''}{abbreviateVND(Math.abs(totalGain))}
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm"
          >
            {t('metals.addEntry')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-[#111] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <EmptyState
          title={t('metals.noHoldings')}
          description={t('metals.noHoldingsDesc')}
          action={{ label: t('metals.addEntry'), onClick: () => setShowModal(true) }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-[#111] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222] text-gray-400 text-xs uppercase tracking-widest">
                  <th className="px-4 py-3 text-left">{t('metals.table.type')}</th>
                  <th className="px-4 py-3 text-left">{t('metals.table.weight')}</th>
                  <th className="px-4 py-3 text-left">{t('metals.table.purity')}</th>
                  <th className="px-4 py-3 text-right">{t('metals.table.buyPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('metals.table.currentPrice')}</th>
                  <th className="px-4 py-3 text-right">{t('metals.table.currentValue')}</th>
                  <th className="px-4 py-3 text-right">{t('metals.table.gainLoss')}</th>
                  <th className="px-4 py-3 text-left">{t('metals.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const gain = parseFloat(h.unrealised_gain);
                  const isPositive = gain >= 0;
                  return (
                    <tr key={h.id} className="border-b border-[#1a1a1a] hover:bg-[#161616]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          {h.metal_type === 'gold' ? '🥇 Gold' : '🥈 Silver'}
                        </div>
                        {h.label && <div className="text-xs text-gray-500">{h.label}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-200">
                        {h.weight_display} {WEIGHT_UNIT_LABELS[h.weight_unit] ?? h.weight_unit}
                        <div className="text-xs text-gray-500">{parseFloat(h.weight_grams).toFixed(2)}g</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{h.purity}%</td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">
                        {formatVND(parseFloat(h.purchase_price_per_gram))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingPrice === h.id ? (
                          <VNDInput
                            className="w-32 bg-[#1a1a1a] border border-green-600 rounded px-2 py-1 text-sm text-white text-right focus:outline-none"
                            autoFocus
                            value={priceInput}
                            onChange={v => setPriceInput(v)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handlePriceEdit(h.id);
                              if (e.key === 'Escape') setEditingPrice(null);
                            }}
                            onBlur={() => handlePriceEdit(h.id)}
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPrice(h.id);
                              setPriceInput(h.current_price_per_gram);
                            }}
                            className="text-white font-mono hover:text-green-400 transition-colors"
                            title="Click to edit current price"
                          >
                            {formatVND(parseFloat(h.current_price_per_gram))}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono font-semibold">
                        {abbreviateVND(parseFloat(h.current_value))}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{abbreviateVND(Math.abs(gain))}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteConfirm(h.id)}
                          className="text-gray-500 hover:text-red-400 text-xs"
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="lg:hidden space-y-4">
            {holdings.map(h => {
              const gain = parseFloat(h.unrealised_gain);
              const isPositive = gain >= 0;
              return (
                <div key={h.id} className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-white">
                        {h.metal_type === 'gold' ? '🥇 Gold' : '🥈 Silver'}
                      </div>
                      {h.label && <div className="text-xs text-gray-500">{h.label}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white font-mono">{abbreviateVND(parseFloat(h.current_value))}</div>
                      <div className={`text-[10px] font-mono font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{abbreviateVND(Math.abs(gain))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t('metals.table.weight')}</div>
                      <div className="text-xs text-gray-200">
                        {h.weight_display} {WEIGHT_UNIT_LABELS[h.weight_unit] ?? h.weight_unit} ({parseFloat(h.weight_grams).toFixed(2)}g)
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t('metals.table.purity')}</div>
                      <div className="text-xs text-gray-200">{h.purity}%</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1a1a1a] flex items-center justify-between">
                    <div className="text-[10px] text-gray-500">
                      {t('metals.table.buyPrice')}: <span className="text-gray-300 font-mono">{abbreviateVND(parseFloat(h.purchase_price_per_gram))}</span>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm(h.id)}
                      className="text-[10px] font-bold text-red-500 uppercase tracking-wider"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add Metal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{t('metals.modals.addTitle')}</h2>
              <button onClick={() => { setShowModal(false); reset(); }} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Metal type toggle */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.metalType')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['gold', 'silver'] as const).map(t_key => (
                    <button key={t_key} type="button" onClick={() => setValue('metal_type', t_key)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        metalType === t_key ? 'bg-green-500 text-black' : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#222]'
                      }`}>
                      {t_key === 'gold' ? '🥇 Gold' : '🥈 Silver'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.label')}</label>
                <input {...register('label')} placeholder={t('metals.modals.labelPlaceholder')}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.weight')}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('weight_display', parseFloat(v) || 0)}
                    value={String(watch('weight_display') || '')}
                    placeholder="1"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.weight_display && <p className="text-red-400 text-xs mt-1">{errors.weight_display.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.weightUnit')}</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['chi', 'luong', 'gram'] as const).map(u => (
                      <button key={u} type="button" onClick={() => setValue('weight_unit', u)}
                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                          weightUnit === u ? 'bg-green-500 text-black' : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#222]'
                        }`}>
                        {WEIGHT_UNIT_LABELS[u]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.purity')}</label>
                <VNDInput
                  onChange={(v: string) => setValue('purity', v)}
                  value={watch('purity')}
                  placeholder={t('metals.modals.purityPlaceholder')}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                />
                {errors.purity && <p className="text-red-400 text-xs mt-1">{errors.purity.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.buyPrice')}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('purchase_price_per_gram', v)}
                    value={watch('purchase_price_per_gram')}
                    placeholder="0.00"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.purchase_price_per_gram && <p className="text-red-400 text-xs mt-1">{errors.purchase_price_per_gram.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.currentPrice')}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('current_price_per_gram', v)}
                    value={watch('current_price_per_gram')}
                    placeholder="0.00"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.current_price_per_gram && <p className="text-red-400 text-xs mt-1">{errors.current_price_per_gram.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.date')}</label>
                  <input type="date" {...register('purchase_date')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                  {errors.purchase_date && <p className="text-red-400 text-xs mt-1">{errors.purchase_date.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('metals.modals.institution')}</label>
                  <select {...register('institution_id', { valueAsNumber: true })}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600">
                    <option value="">{t('common.none')}</option>
                    {institutions.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button type="submit"
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2 rounded-lg text-sm">
                  {t('metals.modals.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-2">{t('metals.modals.deleteTitle')}</h2>
            <p className="text-sm text-gray-400 mb-4">{t('metals.modals.deleteDesc')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-400 text-white rounded-lg font-semibold">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
