import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { abbreviateVND, formatVND } from '../lib/vnd';
import { StatusPill } from '../components/shared/StatusPill';
import { EmptyState } from '../components/shared/EmptyState';
import { VNDInput } from '../components/shared/VNDInput';

interface Institution {
  id: number;
  name: string;
}

interface SavingsInstrument {
  id: number;
  institution_id: number;
  institution_name?: string;
  label: string;
  instrument_type: string;
  principal: string;
  interest_rate: string;
  start_date: string;
  maturity_date: string;
  status: string;
  accrued_interest: string;
}

export default function Savings() {
  const { t } = useTranslation();
  const { success, error: toastError } = useToast();

  function formatProgress(start: string, maturity: string): number {
    const s = new Date(start).getTime();
    const m = new Date(maturity).getTime();
    const n = Date.now();
    if (m <= s) return 100;
    return Math.min(100, Math.max(0, ((n - s) / (m - s)) * 100));
  }

  const SavingsSchema = z.object({
    institution_id: z.union([z.coerce.number().int().positive(t('investmentLedger.errors.required')), z.nan()]).transform(v => typeof v === 'number' && v > 0 ? v : undefined).refine(v => v !== undefined, t('investmentLedger.errors.required')),
    label: z.string().min(1, t('investmentLedger.errors.required')),
    instrument_type: z.enum(['savings_account', 'certificate_of_deposit', 'money_market', 'treasury_bond']),
    principal: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    interest_rate: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    start_date: z.string().min(1, t('investmentLedger.errors.required')),
    maturity_date: z.string().min(1, t('investmentLedger.errors.required')),
  });

  type SavingsForm = z.infer<typeof SavingsSchema>;
  const [instruments, setInstruments] = useState<SavingsInstrument[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<SavingsForm>({
    resolver: zodResolver(SavingsSchema),
    defaultValues: { instrument_type: 'certificate_of_deposit' },
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, bankRes] = await Promise.all([
        apiFetch<{ data: SavingsInstrument[] }>('/api/v1/savings'),
        apiFetch<{ data: Institution[] }>('/api/v1/institutions'),
      ]);
      setInstruments(instRes.data ?? []);
      setInstitutions(bankRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalSavings = instruments.reduce((s, i) => s + parseFloat(i.principal), 0);
  const totalInterest = instruments.reduce((s, i) => s + parseFloat(i.accrued_interest || '0'), 0);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await apiFetch('/api/v1/savings', { method: 'POST', body: data });
      success(t('savings.modals.addTitle'), { message: 'Savings entry added.' });
      setShowModal(false);
      reset();
      fetchAll();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/v1/savings/${id}`, { method: 'DELETE' });
      success('Deleted', { message: 'Savings entry removed.' });
      setDeleteConfirm(null);
      fetchAll();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('savings.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('savings.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right flex-1 lg:flex-none">
            <div className="text-xs text-gray-400">{t('savings.totalSavings')}</div>
            <div className="text-lg font-bold text-green-400">{abbreviateVND(totalSavings)}</div>
          </div>
          <div className="text-right flex-1 lg:flex-none">
            <div className="text-xs text-gray-400">{t('savings.netExposure')}</div>
            <div className="text-lg font-bold text-white">{abbreviateVND(totalInterest)}</div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm"
          >
            {t('savings.addEntry')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-[#111] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : instruments.length === 0 ? (
        <EmptyState
          title={t('savings.noInstruments')}
          description={t('savings.noInstrumentsDesc')}
          action={{ label: t('savings.addEntry'), onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {instruments.map(inst => {
            const progress = formatProgress(inst.start_date, inst.maturity_date);
            const isMatured = inst.status === 'matured';
            return (
              <div key={inst.id} className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{inst.institution_name ?? '—'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isMatured ? 'bg-amber-900/40 text-amber-400' : 'bg-green-900/40 text-green-400'
                        }`}>
                        {inst.interest_rate}% APY
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {t(`enums.savingsTypes.${inst.instrument_type}` as any, { defaultValue: inst.instrument_type })} · {inst.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={inst.status} />
                    <button
                      onClick={() => setDeleteConfirm(inst.id)}
                      className="text-gray-600 hover:text-red-400 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-400">{t('savings.maturityDate')}</div>
                    <div className={`text-sm font-medium ${isMatured ? 'text-amber-400' : 'text-gray-200'}`}>
                      {inst.maturity_date}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">{t('savings.principal')}</div>
                    <div className="text-sm font-semibold text-white">{formatVND(parseFloat(inst.principal))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">{t('savings.accruedInterest')}</div>
                    <div className="text-sm font-semibold text-green-400">{formatVND(parseFloat(inst.accrued_interest || '0'))}</div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{t('savings.termProgress')}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isMatured ? 'bg-amber-400' : 'bg-green-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Savings Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-white">{t('savings.modals.addTitle')}</h2>
              <button onClick={() => { setShowModal(false); reset(); }} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">{t('savings.modals.desc')}</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('savings.modals.institution')}</label>
                  <select {...register('institution_id', { valueAsNumber: true })}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600">
                    <option value="">{t('savings.modals.selectInstitution')}</option>
                    {institutions.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  {errors.institution_id && <p className="text-red-400 text-xs mt-1">{errors.institution_id.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('savings.modals.type')}</label>
                  <select {...register('instrument_type')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600">
                    {['savings_account', 'certificate_of_deposit', 'money_market', 'treasury_bond'].map(v => (
                      <option key={v} value={v}>
                        {t(`enums.savingsTypes.${v}` as any, { defaultValue: v })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('savings.modals.label')}</label>
                <input {...register('label')} placeholder={t('savings.modals.labelPlaceholder')}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600" />
                {errors.label && <p className="text-red-400 text-xs mt-1">{errors.label.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('savings.modals.principal')}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('principal', v)}
                    value={watch('principal')}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.principal && <p className="text-red-400 text-xs mt-1">{errors.principal.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('savings.modals.interestRate')}</label>
                  <div className="relative">
                    <input {...register('interest_rate')} type="number" step="0.01" placeholder="5.50"
                      className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 pr-8 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                  </div>
                  {errors.interest_rate && <p className="text-red-400 text-xs mt-1">{errors.interest_rate.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('savings.modals.startDate')}</label>
                  <input type="date" {...register('start_date')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                  {errors.start_date && <p className="text-red-400 text-xs mt-1">{errors.start_date.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('savings.modals.maturityDate')}</label>
                  <input type="date" {...register('maturity_date')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                  {errors.maturity_date && <p className="text-red-400 text-xs mt-1">{errors.maturity_date.message}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button type="submit"
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2 rounded-lg text-sm">
                  {t('savings.modals.save')}
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
            <h2 className="text-lg font-bold text-white mb-2">{t('savings.modals.deleteTitle')}</h2>
            <p className="text-sm text-gray-400 mb-4">
              {t('savings.modals.deleteDesc')}
            </p>
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
