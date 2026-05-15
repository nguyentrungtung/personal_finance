import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2, Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { formatVND, parseVND } from '../lib/vnd';
import { StatusPill } from '../components/shared/StatusPill';
import { EmptyState } from '../components/shared/EmptyState';
import { VNDInput } from '../components/shared/VNDInput';

interface LedgerEntry {
  id: number; asset_class_code: string; asset_class_label: string;
  institution_name: string | null; entry_type: string; description: string;
  amount: string; status: string; transaction_date: string; notes: string | null;
  source_module: string; source_id: number | null; is_auto: number;
}

const SOURCE_MODULE_ROUTE: Record<string, string> = {
  metals: '/metals',
  savings: '/savings',
  loans: '/loans',
  investment: '/investment-ledger',
};

interface LedgerResponse {
  data: LedgerEntry[];
  meta: { count: number; current_page: number };
}

const ENTRY_TYPES = ['crypto_purchase', 'real_estate_appraisal', 'tax_transfer', 'savings_deposit', 'loan_repayment', 'other'] as const;
const STATUSES = ['completed', 'pending', 'appraisal', 'cleared'] as const;
const ASSET_CLASSES = ['metals', 'markets', 'liquidity', 'real_estate'] as const;

export function Ledger() {
  const { t, i18n } = useTranslation();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  interface AssetClass { id: number; code: string; label: string; }

  const EntrySchema = z.object({
    asset_class_id: z.coerce.number().int().positive(t('investmentLedger.errors.required')),
    institution_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.literal(0), z.nan()]).optional().transform(v => typeof v === 'number' && v > 0 ? v : undefined),
    entry_type: z.enum(ENTRY_TYPES),
    description: z.string().min(1, t('investmentLedger.errors.required')),
    amount: z.string().min(1, t('investmentLedger.errors.required')).regex(/^-?\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    status: z.enum(STATUSES).default('completed'),
    transaction_date: z.string().min(1, t('investmentLedger.errors.required')),
    notes: z.string().optional().transform(v => v === '' ? undefined : v),
  });
  type EntryForm = z.infer<typeof EntrySchema>;

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);

  // Filters
  const [filterAssetClass, setFilterAssetClass] = useState('');
  const [filterEntryType, setFilterEntryType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortCol, setSortCol] = useState('transaction_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const form = useForm<EntryForm>({ resolver: zodResolver(EntrySchema) });

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      ...(filterAssetClass && { asset_class: filterAssetClass }),
      ...(filterEntryType && { entry_type: filterEntryType }),
      ...(filterStatus && { status: filterStatus }),
      ...(filterDateFrom && { date_from: filterDateFrom }),
      ...(filterDateTo && { date_to: filterDateTo }),
      sort: sortCol, sort_dir: sortDir,
      page: String(page),
    });

    try {
      const res = await api.get<LedgerResponse>(`/api/v1/ledger?${params.toString()}`);
      setEntries(res.data);
      setTotalCount(res.meta.count);
    } catch { /* handled by api client */ }
    finally { setIsLoading(false); }
  }, [page, filterAssetClass, filterEntryType, filterStatus, filterDateFrom, filterDateTo, sortCol, sortDir]);

  useEffect(() => { void fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    api.get<{ data: AssetClass[] }>('/api/v1/institutions?include_archived=false')
      .then(() => { /* ignore */ }).catch(() => { /* ignore */ });
    // Fetch asset classes from settings
    setAssetClasses([
      { id: 1, code: 'metals', label: 'Metals' },
      { id: 2, code: 'markets', label: 'Markets' },
      { id: 3, code: 'liquidity', label: 'Liquidity' },
      { id: 4, code: 'real_estate', label: 'Real Estate' },
    ]);
  }, []);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(1);
  };

  const openCreate = () => { setEditEntry(null); form.reset(); setShowModal(true); };
  const openEdit = (entry: LedgerEntry) => {
    setEditEntry(entry);
    form.reset({
      asset_class_id: assetClasses.find((a) => a.code === entry.asset_class_code)?.id,
      entry_type: entry.entry_type as EntryForm['entry_type'],
      description: entry.description,
      amount: entry.amount,
      status: entry.status as EntryForm['status'],
      transaction_date: entry.transaction_date.split('T')[0],
      notes: entry.notes ?? '',
    });
    setShowModal(true);
  };

  const onSubmit = async (data: EntryForm) => {
    try {
      if (editEntry) {
        await api.put(`/api/v1/ledger/${editEntry.id}`, data);
      } else {
        await api.post('/api/v1/ledger', data);
      }
      success(t('ledger.addEntry'), { message: 'Entry saved.' });
      setShowModal(false);
      void fetchEntries();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/v1/ledger/${id}?confirm=true`);
      success('Deleted', { message: 'Entry deleted.' });
      setDeleteConfirm(null);
      void fetchEntries();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />;
  };

  const totalPages = Math.ceil(totalCount / 50);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('ledger.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('ledger.entries_count', { count: totalCount, label: t('ledger.entries') })}
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary" aria-label={t('ledger.addEntry')}>
          <Plus size={16} aria-hidden />
          {t('ledger.addEntry')}
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-3 mb-4 stack-on-mobile" role="search" aria-label="Filter ledger entries">
        <select className="input w-auto min-w-[140px] stack-on-mobile:w-full" aria-label={t('ledger.allAssetClasses')} value={filterAssetClass} onChange={(e) => { setFilterAssetClass(e.target.value); setPage(1); }}>
          <option value="">{t('ledger.allAssetClasses')}</option>
          {ASSET_CLASSES.map((c) => (
            <option key={c} value={c}>
              {t(`enums.assetClasses.${c}` as any)}
            </option>
          ))}
        </select>
        <select className="input w-auto min-w-[140px] stack-on-mobile:w-full" aria-label={t('ledger.allTypes')} value={filterEntryType} onChange={(e) => { setFilterEntryType(e.target.value); setPage(1); }}>
          <option value="">{t('ledger.allTypes')}</option>
          {ENTRY_TYPES.map((t_code) => (
            <option key={t_code} value={t_code}>
              {t(`enums.entryTypes.${t_code}` as any)}
            </option>
          ))}
        </select>
        <select className="input w-auto min-w-[140px] stack-on-mobile:w-full" aria-label={t('ledger.allStatuses')} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">{t('ledger.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.statuses.${s}` as any)}
            </option>
          ))}
        </select>
        <div className="flex gap-2 stack-on-mobile:w-full">
          <input type="date" className="input w-auto stack-on-mobile:flex-1" aria-label={t('ledger.date')} value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }} />
          <input type="date" className="input w-auto stack-on-mobile:flex-1" aria-label={t('ledger.date')} value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Content Area */}
      <div className="card p-0 overflow-hidden bg-transparent border-0 lg:bg-surface-card lg:border lg:border-surface-border">
        {isLoading ? (
          <div className="p-8 space-y-3 bg-surface-card rounded-card">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="h-4 bg-surface-border rounded flex-1" />
                <div className="h-4 bg-surface-border rounded flex-1" />
                <div className="h-4 bg-surface-border rounded w-24" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-surface-card rounded-card">
            <EmptyState
              title={t('ledger.noEntries')}
              description={t('ledger.noEntriesDesc')}
              action={<button type="button" onClick={openCreate} className="btn-primary">{t('ledger.addEntry')}</button>}
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left" role="table">
                <thead>
                  <tr className="text-xs text-text-muted border-b border-surface-border bg-surface">
                    <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('transaction_date')} scope="col">
                      <span className="flex items-center gap-1">{t('ledger.date')} <SortIcon col="transaction_date" /></span>
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">{t('ledger.assetClass')}</th>
                    <th className="px-4 py-3 font-medium" scope="col">{t('ledger.type')}</th>
                    <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('description')} scope="col">
                      <span className="flex items-center gap-1">{t('ledger.description')} <SortIcon col="description" /></span>
                    </th>
                    <th className="px-4 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('amount')} scope="col">
                      <span className="flex items-center gap-1 justify-end">{t('ledger.amount')} <SortIcon col="amount" /></span>
                    </th>
                    <th className="px-4 py-3 font-medium text-center cursor-pointer" onClick={() => handleSort('status')} scope="col">
                      <span className="flex items-center gap-1 justify-center">{t('ledger.status')} <SortIcon col="status" /></span>
                    </th>
                    <th className="px-4 py-3 font-medium text-center" scope="col">{t('ledger.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const amount = parseVND(entry.amount);
                    const isAuto = entry.is_auto === 1;
                    const sourceRoute = isAuto ? SOURCE_MODULE_ROUTE[entry.source_module] : null;
                    return (
                      <tr key={entry.id} className="border-b border-surface-border/50 last:border-0 hover:bg-surface-hover/30">
                        <td className="px-4 py-3 text-xs text-text-muted">{new Date(entry.transaction_date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-surface border border-border-subtle text-text-secondary">
                            {t(`enums.assetClasses.${entry.asset_class_code}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-surface-input text-text-secondary">
                              {t(`enums.entryTypes.${entry.entry_type}` as any)}
                            </span>
                            {isAuto && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {entry.source_module}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary max-w-xs truncate">{entry.description}</td>
                        <td className={`px-4 py-3 text-sm font-mono text-right ${amount < 0 ? 'text-brand-red' : 'text-brand-green'}`}>
                          {formatVND(amount, { showUnit: false })}
                        </td>
                        <td className="px-4 py-3 text-center"><StatusPill status={entry.status} /></td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isAuto ? (
                              <button
                                type="button"
                                onClick={() => sourceRoute && navigate(sourceRoute)}
                                className="p-1 text-blue-400 hover:text-blue-300"
                                title={`Được tạo tự động từ ${entry.source_module}. Nhấn để đến trang nguồn.`}
                                aria-label={`Go to ${entry.source_module}`}
                              >
                                <Link size={14} aria-hidden />
                              </button>
                            ) : (
                              <>
                                <button type="button" onClick={() => openEdit(entry)} className="p-1 text-text-muted hover:text-text-primary" aria-label={`${t('common.edit')} ${entry.description}`}>
                                  <Pencil size={14} aria-hidden />
                                </button>
                                <button type="button" onClick={() => setDeleteConfirm(entry.id)} className="p-1 text-text-muted hover:text-brand-red" aria-label={`${t('common.delete')} ${entry.description}`}>
                                  <Trash2 size={14} aria-hidden />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="lg:hidden space-y-3">
              {entries.map((entry) => {
                const amount = parseVND(entry.amount);
                const isAuto = entry.is_auto === 1;
                return (
                  <div key={entry.id} className="card p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">
                          {new Date(entry.transaction_date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                        </span>
                        <h3 className="text-sm font-medium text-text-primary leading-tight">{entry.description}</h3>
                      </div>
                      <div className={`text-sm font-mono font-semibold ${amount < 0 ? 'text-brand-red' : 'text-brand-green'}`}>
                        {formatVND(amount, { showUnit: false })}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text-secondary">
                        {t(`enums.assetClasses.${entry.asset_class_code}` as any)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-input text-text-secondary">
                        {t(`enums.entryTypes.${entry.entry_type}` as any)}
                      </span>
                      <StatusPill status={entry.status} className="scale-90 origin-left" />
                    </div>

                    {!isAuto && (
                      <div className="flex gap-3 pt-2 border-t border-surface-border">
                        <button type="button" onClick={() => openEdit(entry)} className="flex-1 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-hover/30 rounded flex items-center justify-center gap-2">
                          <Pencil size={12} /> {t('common.edit')}
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(entry.id)} className="flex-1 py-2 text-xs font-medium text-brand-red hover:bg-brand-red/10 rounded flex items-center justify-center gap-2 border border-brand-red/20">
                          <Trash2 size={12} /> {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-text-muted">{t('ledger.pagination', { current: page, total: totalPages })}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost" aria-label={t('ledger.prev')}>
              <ChevronLeft size={14} aria-hidden /> {t('ledger.prev')}
            </button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost" aria-label={t('ledger.next')}>
              {t('ledger.next')} <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={editEntry ? t('ledger.editEntry') : t('ledger.addEntry')}>
          <div className="card w-full max-w-lg max-h-screen overflow-y-auto">
            <h2 className="text-lg font-semibold text-text-primary mb-4">{editEntry ? t('ledger.editEntry') : t('ledger.addEntry')}</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1" htmlFor="asset-class-id">{t('ledger.assetClass')}</label>
                <select id="asset-class-id" className="input" aria-required="true" {...form.register('asset_class_id', { valueAsNumber: true })}>
                  <option value="">{t('ledger.select')}</option>
                  {assetClasses.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      {t(`enums.assetClasses.${ac.code}` as any)}
                    </option>
                  ))}
                </select>
                {form.formState.errors.asset_class_id && <p role="alert" className="text-xs text-brand-red mt-1">{form.formState.errors.asset_class_id.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1" htmlFor="entry-type">{t('ledger.entryType')}</label>
                <select id="entry-type" className="input" {...form.register('entry_type')}>
                  {ENTRY_TYPES.map((t_code) => (
                    <option key={t_code} value={t_code}>
                      {t(`enums.entryTypes.${t_code}` as any)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1" htmlFor="description">{t('ledger.description')}</label>
                <input id="description" className="input" aria-required="true" {...form.register('description')} />
                {form.formState.errors.description && <p role="alert" className="text-xs text-brand-red mt-1">{form.formState.errors.description.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1" htmlFor="amount">{t('ledger.amountVnd')}</label>
                <VNDInput onChange={(v) => form.setValue('amount', v)} value={form.watch('amount')} />
                {form.formState.errors.amount && <p role="alert" className="text-xs text-brand-red mt-1">{form.formState.errors.amount.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1" htmlFor="status">{t('ledger.status')}</label>
                <select id="status" className="input" {...form.register('status')}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`enums.statuses.${s}` as any)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1" htmlFor="transaction-date">{t('ledger.date')}</label>
                <input id="transaction-date" type="date" className="input" aria-required="true" {...form.register('transaction_date')} />
                {form.formState.errors.transaction_date && <p role="alert" className="text-xs text-brand-red mt-1">{form.formState.errors.transaction_date.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1" htmlFor="notes">{t('ledger.notes')}</label>
                <textarea id="notes" className="input h-20 resize-none" {...form.register('notes')} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" aria-label="Save entry">{editEntry ? t('common.save') : t('common.add')}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="alertdialog" aria-modal="true" aria-label={t('ledger.confirmDelete')}>
          <div className="card w-full max-w-sm">
            <h3 className="text-base font-semibold text-text-primary mb-2">{t('ledger.confirmDelete')}</h3>
            <p className="text-sm text-text-secondary mb-4">{t('ledger.deleteDescription')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => void handleDelete(deleteConfirm)} className="btn-primary flex-1 !bg-brand-red !hover:bg-red-700">{t('common.delete')}</button>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-ghost flex-1">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
