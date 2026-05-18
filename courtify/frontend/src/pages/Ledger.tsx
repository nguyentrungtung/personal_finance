import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Pencil, Link, Search, X, CheckSquare, Square, RotateCcw, History, AlertTriangle } from 'lucide-react';
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
  voided_at: string | null; void_reason: string | null;
  reversal_of: number | null;
  versions_count?: number;
}

interface EntryVersion {
  id: number; entry_id: number; version: number;
  snapshot: string; edit_reason: string | null; changed_at: string;
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

const ENTRY_TYPES_BY_CLASS: Record<string, readonly string[]> = {
  metals:      ['metal_purchase', 'metal_sale', 'metal_appraisal', 'other'],
  markets:     ['crypto_purchase', 'crypto_sale', 'stock_purchase', 'stock_sale', 'dividend', 'other'],
  liquidity:   ['savings_deposit', 'savings_withdrawal', 'interest_income', 'tax_transfer', 'loan_repayment', 'other'],
  real_estate: ['real_estate_purchase', 'real_estate_appraisal', 'rental_income', 'tax_transfer', 'other'],
};

// All entry types (used in filter toolbar — cross-class)
const ALL_ENTRY_TYPES = [
  'crypto_purchase', 'crypto_sale', 'stock_purchase', 'stock_sale', 'dividend',
  'metal_purchase', 'metal_sale', 'metal_appraisal',
  'real_estate_purchase', 'real_estate_appraisal', 'rental_income',
  'savings_deposit', 'savings_withdrawal', 'interest_income',
  'tax_transfer', 'loan_repayment', 'other',
] as const;

// Statuses available for create/edit forms
const EDITABLE_STATUSES = ['completed', 'pending', 'appraisal', 'cleared'] as const;
// All statuses including terminal ones — used in filter toolbar
const ALL_STATUSES = ['completed', 'pending', 'appraisal', 'cleared', 'voided', 'reversed'] as const;
const STATUSES = EDITABLE_STATUSES;
const ASSET_CLASSES = ['metals', 'markets', 'liquidity', 'real_estate'] as const;

export function Ledger() {
  const { t, i18n } = useTranslation();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  interface AssetClass { id: number; code: string; label: string; }

  const EntrySchema = z.object({
    asset_class_id: z.coerce.number().int().positive(t('investmentLedger.errors.required')),
    institution_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.literal(0), z.nan()]).optional().transform(v => typeof v === 'number' && v > 0 ? v : undefined),
    entry_type: z.string().min(1, t('investmentLedger.errors.required')),
    description: z.string().min(1, t('investmentLedger.errors.required')),
    amount: z.string().min(1, t('investmentLedger.errors.required')).regex(/^-?\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    status: z.enum(STATUSES).default('completed'),
    transaction_date: z.string().min(1, t('investmentLedger.errors.required')),
    notes: z.string().optional().transform(v => v === '' ? undefined : v),
    edit_reason: z.string().optional().transform(v => v === '' ? undefined : v),
  });
  type EntryForm = z.infer<typeof EntrySchema>;

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Inline status update ───────────────────────────────────────────────────
  const [inlineStatusId, setInlineStatusId] = useState<number | null>(null);

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatusModal, setBulkStatusModal] = useState(false);

  // ── Void ───────────────────────────────────────────────────────────────────
  const [voidTarget, setVoidTarget] = useState<LedgerEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoided, setShowVoided] = useState(false);

  // ── Reversal ───────────────────────────────────────────────────────────────
  const [reverseTarget, setReverseTarget] = useState<LedgerEntry | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  // ── Versions (edit history) ────────────────────────────────────────────────
  const [versionsTarget, setVersionsTarget] = useState<LedgerEntry | null>(null);
  const [versions, setVersions] = useState<EntryVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Filters
  const [filterAssetClass, setFilterAssetClass] = useState('');
  const [filterEntryType, setFilterEntryType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortCol, setSortCol] = useState('transaction_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const form = useForm<EntryForm>({ resolver: zodResolver(EntrySchema) });

  // Watch asset_class_id to filter entry types dynamically
  const watchedAssetClassId = form.watch('asset_class_id');
  const selectedAssetCode = assetClasses.find(a => a.id === Number(watchedAssetClassId))?.code ?? '';
  const activeEntryTypes = ENTRY_TYPES_BY_CLASS[selectedAssetCode] ?? ALL_ENTRY_TYPES;

  // When asset class changes in the form, reset entry_type to first valid option
  useEffect(() => {
    if (!watchedAssetClassId) return;
    const currentEntryType = form.getValues('entry_type');
    const validTypes = ENTRY_TYPES_BY_CLASS[selectedAssetCode] ?? ALL_ENTRY_TYPES;
    if (!validTypes.includes(currentEntryType)) {
      form.setValue('entry_type', validTypes[0] as string);
    }
  }, [watchedAssetClassId, selectedAssetCode, form]);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      ...(filterAssetClass && { asset_class: filterAssetClass }),
      ...(filterEntryType && { entry_type: filterEntryType }),
      ...(filterStatus && { status: filterStatus }),
      ...(filterDateFrom && { date_from: filterDateFrom }),
      ...(filterDateTo && { date_to: filterDateTo }),
      ...(searchQuery && { search: searchQuery }),
      ...(showVoided && { include_voided: 'true' }),
      sort: sortCol, sort_dir: sortDir,
      page: String(page),
    });

    try {
      const res = await api.get<LedgerResponse>(`/api/v1/ledger?${params.toString()}`);
      setEntries(res.data);
      setTotalCount(res.meta.count);
      // Clear selection when data changes
      setSelectedIds(new Set());
    } catch { /* handled by api client */ }
    finally { setIsLoading(false); }
  }, [page, filterAssetClass, filterEntryType, filterStatus, filterDateFrom, filterDateTo, searchQuery, showVoided, sortCol, sortDir]);

  // Debounce search input — wait 400ms after user stops typing
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
    }, 400);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

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


  // ── Inline status update ───────────────────────────────────────────────────
  const handleInlineStatus = async (id: number, newStatus: string) => {
    // Optimistic update
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    setInlineStatusId(null);
    try {
      await api.patch(`/api/v1/ledger/${id}/status`, { status: newStatus });
    } catch (e: unknown) {
      // Rollback on failure
      void fetchEntries();
      toastError('Không thể cập nhật', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  // ── Bulk selection helpers ─────────────────────────────────────────────────
  // Only manual entries (is_auto=0) can be bulk-selected
  const manualEntries = entries.filter(e => e.is_auto === 0 && !e.voided_at && e.status !== 'reversed');
  const allManualSelected = manualEntries.length > 0 && manualEntries.every(e => selectedIds.has(e.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allManualSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(manualEntries.map(e => e.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Bulk status update ─────────────────────────────────────────────────────
  const handleBulkStatus = async (newStatus: string) => {
    const ids = Array.from(selectedIds);
    // Optimistic update
    setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: newStatus } : e));
    setSelectedIds(new Set());
    setBulkStatusModal(false);
    try {
      const res = await api.patch<{ data: { updated_count: number } }>('/api/v1/ledger/bulk-status', { ids, status: newStatus });
      success(t('ledger.bulkUpdated'), { message: `${res.data.updated_count} ${t('ledger.entries')}` });
    } catch (e: unknown) {
      void fetchEntries();
      toastError('Bulk update failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  // ── Void entry ────────────────────────────────────────────────────────────
  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) return;
    try {
      await api.patch(`/api/v1/ledger/${voidTarget.id}/void`, { reason: voidReason.trim() });
      success(t('ledger.voidSuccess'), { message: voidTarget.description });
      setVoidTarget(null);
      setVoidReason('');
      void fetchEntries();
    } catch (e: unknown) {
      toastError(t('ledger.voidFailed'), { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  // ── Reversal ──────────────────────────────────────────────────────────────
  const handleReverse = async () => {
    if (!reverseTarget || !reverseReason.trim()) return;
    try {
      await api.post(`/api/v1/ledger/${reverseTarget.id}/reverse`, { reason: reverseReason.trim() });
      success(t('ledger.reversalCreated'), { message: reverseTarget.description });
      setReverseTarget(null);
      setReverseReason('');
      void fetchEntries();
    } catch (e: unknown) {
      toastError(t('ledger.reversalFailed'), { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  // ── Version history ───────────────────────────────────────────────────────
  const handleViewVersions = async (entry: LedgerEntry) => {
    setVersionsTarget(entry);
    setVersionsLoading(true);
    try {
      const res = await api.get<{ data: EntryVersion[] }>(`/api/v1/ledger/${entry.id}/versions`);
      setVersions(res.data);
    } catch { setVersions([]); }
    finally { setVersionsLoading(false); }
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
      <div className="flex flex-wrap gap-3 mb-3 stack-on-mobile" role="search" aria-label="Filter ledger entries">
        {/* Search box */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden />
          <input
            type="text"
            className="input pl-8 pr-8 w-full"
            placeholder={t('ledger.searchPlaceholder')}
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            aria-label={t('ledger.searchPlaceholder')}
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
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
          {ALL_ENTRY_TYPES.map((t_code) => (
            <option key={t_code} value={t_code}>
              {t(`enums.entryTypes.${t_code}` as any)}
            </option>
          ))}
        </select>
        <select className="input w-auto min-w-[140px] stack-on-mobile:w-full" aria-label={t('ledger.allStatuses')} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">{t('ledger.allStatuses')}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.statuses.${s}` as any)}
            </option>
          ))}
        </select>
        <div className="flex gap-2 stack-on-mobile:w-full">
          <input type="date" className="input w-auto stack-on-mobile:flex-1" aria-label={t('ledger.date')} value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }} />
          <input type="date" className="input w-auto stack-on-mobile:flex-1" aria-label={t('ledger.date')} value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }} />
        </div>
        {/* Toggle show voided entries */}
        <button
          type="button"
          onClick={() => { setShowVoided(v => !v); setPage(1); }}
          className={`input w-auto text-xs flex items-center gap-1.5 ${showVoided ? 'border-amber-500 text-amber-400' : 'text-text-muted'}`}
          aria-pressed={showVoided}
        >
          <span className={`w-2 h-2 rounded-full ${showVoided ? 'bg-amber-400' : 'bg-surface-border'}`} />
          {t('ledger.showVoided')}
        </button>
      </div>

      {/* Bulk action bar — shown when rows are selected */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-surface-card border border-surface-border rounded-lg">
          <span className="text-sm text-text-secondary">
            {t('ledger.selectedCount', { count: selectedIds.size })}
          </span>
          <button
            type="button"
            onClick={() => setBulkStatusModal(true)}
            className="btn-ghost text-xs py-1 px-3"
          >
            {t('ledger.bulkChangeStatus')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-text-muted hover:text-text-primary"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
                    {/* Checkbox select-all */}
                    <th className="px-3 py-3 w-8" scope="col">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-text-muted hover:text-text-primary"
                        aria-label={allManualSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allManualSelected
                          ? <CheckSquare size={14} className="text-brand-green" aria-hidden />
                          : <Square size={14} aria-hidden />
                        }
                      </button>
                    </th>
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
                    const isSelected = selectedIds.has(entry.id);
                    const showInlineStatus = inlineStatusId === entry.id;
                    const isVoided = !!entry.voided_at;
                    const isReversed = entry.status === 'reversed';
                    const isReversal = !!entry.reversal_of;
                    const hasVersions = (entry.versions_count ?? 0) > 0;
                    const isTerminal = isVoided || isReversed;
                    return (
                      <tr key={entry.id} className={`border-b border-surface-border/50 last:border-0 hover:bg-surface-hover/30 ${isSelected ? 'bg-surface-hover/20' : ''} ${isTerminal ? 'opacity-50' : ''}`}>
                        {/* Checkbox — only for manual, non-terminal entries */}
                        <td className="px-3 py-3 w-8">
                          {!isAuto && !isTerminal && (
                            <button
                              type="button"
                              onClick={() => toggleSelectOne(entry.id)}
                              className="text-text-muted hover:text-text-primary"
                              aria-label={isSelected ? 'Deselect' : 'Select'}
                            >
                              {isSelected
                                ? <CheckSquare size={14} className="text-brand-green" aria-hidden />
                                : <Square size={14} aria-hidden />
                              }
                            </button>
                          )}
                        </td>
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
                        <td className="px-4 py-3 text-sm text-text-primary max-w-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="truncate">{entry.description}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {isReversal && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                  {t('ledger.reversalBadge')} #{entry.reversal_of}
                                </span>
                              )}
                              {hasVersions && (
                                <button
                                  type="button"
                                  onClick={() => void handleViewVersions(entry)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 flex items-center gap-0.5"
                                  title={t('ledger.viewVersions')}
                                >
                                  <History size={9} aria-hidden /> {t('ledger.editedBadge')}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm font-mono text-right ${amount < 0 ? 'text-brand-red' : 'text-brand-green'}`}>
                          {formatVND(amount, { showUnit: false })}
                        </td>
                        {/* Inline status — click badge to open dropdown (disabled for terminal entries) */}
                        <td className="px-4 py-3 text-center relative">
                          {!isAuto && !isTerminal && showInlineStatus ? (
                            <div className="relative inline-block">
                              <select
                                autoFocus
                                className="input text-xs py-0.5 px-2 w-32"
                                defaultValue={entry.status}
                                onBlur={() => setInlineStatusId(null)}
                                onChange={e => void handleInlineStatus(entry.id, e.target.value)}
                                aria-label="Change status"
                              >
                                {STATUSES.map(s => (
                                  <option key={s} value={s}>{t(`enums.statuses.${s}` as any)}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => !isAuto && !isTerminal && setInlineStatusId(entry.id)}
                              className={!isAuto && !isTerminal ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
                              title={!isAuto && !isTerminal ? t('ledger.clickToChangeStatus') : undefined}
                              aria-label={!isAuto && !isTerminal ? `${t('ledger.clickToChangeStatus')}: ${entry.status}` : entry.status}
                            >
                              <StatusPill status={entry.status} />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
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
                            ) : isTerminal ? (
                              // Voided or Reversed — show reason tooltip, view history only
                              <span
                                className="text-xs text-text-muted italic cursor-help"
                                title={isVoided ? `${t('ledger.voidedReason')}: ${entry.void_reason ?? ''}` : t('enums.statuses.reversed')}
                              >
                                {isVoided ? t('ledger.voided') : t('enums.statuses.reversed')}
                              </span>
                            ) : (
                              <>
                                <button type="button" onClick={() => openEdit(entry)} className="p-1 text-text-muted hover:text-text-primary" title={t('common.edit')} aria-label={`${t('common.edit')} ${entry.description}`}>
                                  <Pencil size={14} aria-hidden />
                                </button>
                                {/* Reverse — for completed/cleared entries */}
                                {(entry.status === 'completed' || entry.status === 'cleared') && (
                                  <button
                                    type="button"
                                    onClick={() => { setReverseTarget(entry); setReverseReason(''); }}
                                    className="p-1 text-text-muted hover:text-purple-400"
                                    title={t('ledger.reverseEntry')}
                                    aria-label={`${t('ledger.reverseEntry')}: ${entry.description}`}
                                  >
                                    <RotateCcw size={14} aria-hidden />
                                  </button>
                                )}
                                {/* Void — accounting-correct cancellation */}
                                <button
                                  type="button"
                                  onClick={() => { setVoidTarget(entry); setVoidReason(''); }}
                                  className="p-1 text-text-muted hover:text-amber-400"
                                  title={t('ledger.voidEntry')}
                                  aria-label={`${t('ledger.voidEntry')}: ${entry.description}`}
                                >
                                  <X size={14} aria-hidden />
                                </button>
                                {/* View edit history */}
                                {hasVersions && (
                                  <button
                                    type="button"
                                    onClick={() => void handleViewVersions(entry)}
                                    className="p-1 text-text-muted hover:text-blue-400"
                                    title={t('ledger.viewVersions')}
                                    aria-label={t('ledger.viewVersions')}
                                  >
                                    <History size={14} aria-hidden />
                                  </button>
                                )}
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
                        {entry.voided_at ? (
                          <span className="flex-1 py-2 text-xs text-center text-amber-400 italic">
                            {t('ledger.voided')} — {entry.void_reason}
                          </span>
                        ) : (
                          <>
                            <button type="button" onClick={() => openEdit(entry)} className="flex-1 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface-hover/30 rounded flex items-center justify-center gap-2">
                              <Pencil size={12} /> {t('common.edit')}
                            </button>
                            {(entry.status === 'completed' || entry.status === 'cleared') && (
                              <button
                                type="button"
                                onClick={() => { setReverseTarget(entry); setReverseReason(''); }}
                                className="flex-1 py-2 text-xs font-medium text-purple-400 hover:bg-purple-400/10 rounded flex items-center justify-center gap-2 border border-purple-400/20"
                              >
                                <RotateCcw size={12} /> {t('ledger.reverseEntry')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setVoidTarget(entry); setVoidReason(''); }}
                              className="flex-1 py-2 text-xs font-medium text-amber-400 hover:bg-amber-400/10 rounded flex items-center justify-center gap-2 border border-amber-400/20"
                            >
                              <X size={12} /> {t('ledger.voidEntry')}
                            </button>
                          </>
                        )}
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
            {/* Warning when editing a completed/cleared entry */}
            {editEntry && (editEntry.status === 'completed' || editEntry.status === 'cleared') && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-300 leading-relaxed">{t('ledger.editWarningCompleted')}</p>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setReverseTarget(editEntry); setReverseReason(''); }}
                    className="mt-1.5 text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2"
                  >
                    {t('ledger.editWarningCompletedAction')}
                  </button>
                </div>
              </div>
            )}
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
                <select
                  id="entry-type"
                  className="input"
                  disabled={!watchedAssetClassId}
                  {...form.register('entry_type')}
                >
                  {!watchedAssetClassId && (
                    <option value="">{t('ledger.selectAssetClassFirst')}</option>
                  )}
                  {activeEntryTypes.map((t_code) => (
                    <option key={t_code} value={t_code}>
                      {t(`enums.entryTypes.${t_code}` as any)}
                    </option>
                  ))}
                </select>
                {!watchedAssetClassId && (
                  <p className="text-xs text-text-muted mt-1">← {t('ledger.selectAssetClassFirst')}</p>
                )}
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
              {/* edit_reason — only shown when editing existing entry */}
              {editEntry && (
                <div>
                  <label className="block text-sm text-text-secondary mb-1" htmlFor="edit-reason">{t('ledger.editReason')}</label>
                  <input id="edit-reason" className="input" placeholder={t('ledger.editReasonPlaceholder')} {...form.register('edit_reason')} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" aria-label="Save entry">{editEntry ? t('common.save') : t('common.add')}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal modal */}
      {reverseTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="alertdialog" aria-modal="true" aria-label={t('ledger.reverseEntryTitle')}>
          <div className="card w-full max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <RotateCcw size={16} className="text-purple-400" aria-hidden />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{t('ledger.reverseEntryTitle')}</h3>
                <p className="text-xs text-text-muted mt-0.5">{reverseTarget.description}</p>
              </div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-xs text-purple-300 leading-relaxed">{t('ledger.reverseExplanation')}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-text-secondary mb-1" htmlFor="reverse-reason">
                {t('ledger.reverseReason')} <span className="text-brand-red">*</span>
              </label>
              <textarea
                id="reverse-reason"
                className="input h-20 resize-none w-full"
                placeholder={t('ledger.reverseReasonPlaceholder')}
                value={reverseReason}
                onChange={e => setReverseReason(e.target.value)}
                autoFocus
              />
              {reverseReason.trim().length > 0 && reverseReason.trim().length < 3 && (
                <p className="text-xs text-brand-red mt-1">{t('ledger.voidReasonMinLength')}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleReverse()}
                disabled={reverseReason.trim().length < 3}
                className="btn-primary flex-1 !bg-purple-600 hover:!bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('ledger.confirmReverse')}
              </button>
              <button type="button" onClick={() => { setReverseTarget(null); setReverseReason(''); }} className="btn-ghost flex-1">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Versions (edit history) modal */}
      {versionsTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={t('ledger.versionsTitle')}>
          <div className="card w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text-primary">{t('ledger.versionsTitle')}</h3>
              <button type="button" onClick={() => setVersionsTarget(null)} className="text-text-muted hover:text-text-primary" aria-label={t('common.cancel')}><X size={16} /></button>
            </div>
            <p className="text-xs text-text-muted mb-4 truncate">{versionsTarget.description}</p>
            {versionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 bg-surface-border rounded animate-pulse" />)}
              </div>
            ) : versions.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">{t('ledger.versionsEmpty')}</p>
            ) : (
              <div className="space-y-3">
                {versions.map(v => {
                  const snap = JSON.parse(v.snapshot) as Record<string, unknown>;
                  return (
                    <div key={v.id} className="border border-surface-border rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-secondary">{t('ledger.versionN', { n: v.version })}</span>
                        <span className="text-text-muted">{new Date(v.changed_at).toLocaleString()}</span>
                      </div>
                      {v.edit_reason && (
                        <p className="text-amber-300"><span className="text-text-muted">{t('ledger.versionReason')}:</span> {v.edit_reason}</p>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-text-muted mt-1">
                        <span>Amount: <span className="text-text-primary font-mono">{snap.amount as string}</span></span>
                        <span>Status: <span className="text-text-primary">{snap.status as string}</span></span>
                        <span className="col-span-2">Description: <span className="text-text-primary">{snap.description as string}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk status update modal */}
      {bulkStatusModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={t('ledger.bulkChangeStatus')}>
          <div className="card w-full max-w-sm">
            <h3 className="text-base font-semibold text-text-primary mb-1">{t('ledger.bulkChangeStatus')}</h3>
            <p className="text-sm text-text-secondary mb-4">
              {t('ledger.selectedCount', { count: selectedIds.size })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void handleBulkStatus(s)}
                  className="btn-ghost text-sm py-2 justify-center"
                >
                  <StatusPill status={s} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setBulkStatusModal(false)}
              className="btn-ghost w-full mt-3 text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Void entry modal */}
      {voidTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="alertdialog" aria-modal="true" aria-label={t('ledger.voidEntry')}>
          <div className="card w-full max-w-md">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <X size={16} className="text-amber-400" aria-hidden />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{t('ledger.voidEntry')}</h3>
                <p className="text-xs text-text-muted mt-0.5">{voidTarget.description}</p>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-xs text-amber-300 leading-relaxed">
                {t('ledger.voidExplanation')}
              </p>
            </div>

            {/* Reason input */}
            <div className="mb-4">
              <label className="block text-sm text-text-secondary mb-1" htmlFor="void-reason">
                {t('ledger.voidReason')} <span className="text-brand-red">*</span>
              </label>
              <textarea
                id="void-reason"
                className="input h-20 resize-none w-full"
                placeholder={t('ledger.voidReasonPlaceholder')}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                autoFocus
              />
              {voidReason.trim().length > 0 && voidReason.trim().length < 3 && (
                <p className="text-xs text-brand-red mt-1">{t('ledger.voidReasonMinLength')}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleVoid()}
                disabled={voidReason.trim().length < 3}
                className="btn-primary flex-1 !bg-amber-500 hover:!bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('ledger.confirmVoid')}
              </button>
              <button
                type="button"
                onClick={() => { setVoidTarget(null); setVoidReason(''); }}
                className="btn-ghost flex-1"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
