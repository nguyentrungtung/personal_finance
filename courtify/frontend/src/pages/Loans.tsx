import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { abbreviateVND } from '../lib/vnd';
import { StatusPill } from '../components/shared/StatusPill';
import { EmptyState } from '../components/shared/EmptyState';
import { VNDInput } from '../components/shared/VNDInput';

interface Loan {
  id: number;
  loan_type: string;
  counterparty_name: string;
  principal: string;
  remaining_balance: string;
  date_issued: string;
  expected_due_date: string;
  repayment_terms?: string;
  description?: string;
  interest_rate?: string;
  interest_type?: string;
  status: string;
}

interface Payment {
  id: number;
  loan_id: number;
  scheduled_amount: string;
  paid_amount: string;
  due_date: string;
  status: string;
  notes?: string;
}

export default function Loans() {
  const { t } = useTranslation();
  const { success, error: toastError } = useToast();

  function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-xl p-5">
        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">{label}</div>
        <div className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    );
  }

  const LoanSchema = z.object({
    loan_type: z.enum(['lent', 'borrowed']),
    counterparty_name: z.string().min(1, t('investmentLedger.errors.required')),
    principal: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    date_issued: z.string().min(1, t('investmentLedger.errors.required')),
    expected_due_date: z.string().min(1, t('investmentLedger.errors.required')),
    repayment_terms: z.string().optional().transform(v => v === '' ? undefined : v),
    description: z.string().optional().transform(v => v === '' ? undefined : v),
    interest_rate: z.string().optional().transform(v => v === '' ? undefined : v).refine(v => !v || /^\d+(\.\d+)?$/.test(v), t('investmentLedger.errors.invalidNumber')),
    interest_type: z.enum(['percentage', 'fixed']).default('percentage'),
  });

  const PaymentSchema = z.object({
    paid_amount: z.string().min(1, t('investmentLedger.errors.required')).regex(/^\d+(\.\d+)?$/, t('investmentLedger.errors.invalidNumber')),
    due_date: z.string().min(1, t('investmentLedger.errors.required')),
    notes: z.string().optional().transform(v => v === '' ? undefined : v),
  });

  type LoanForm = z.infer<typeof LoanSchema>;
  type PaymentForm = z.infer<typeof PaymentSchema>;
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payments, setPayments] = useState<Record<number, Payment[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<LoanForm>({
    resolver: zodResolver(LoanSchema),
    defaultValues: { loan_type: 'lent', interest_type: 'percentage' },
  });

  const payForm = useForm<PaymentForm>({ resolver: zodResolver(PaymentSchema) });

  const loanType = watch('loan_type');

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterType !== 'all' ? `?type=${filterType}` : '';
      const res = await apiFetch<{ data: Loan[] }>(`/api/v1/loans${params}`);
      setLoans(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const fetchPayments = async (loanId: number) => {
    if (payments[loanId]) return;
    const res = await apiFetch<{ data: Payment[] }>(`/api/v1/loans/${loanId}/payments`);
    setPayments(p => ({ ...p, [loanId]: res.data ?? [] }));
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    fetchPayments(id);
  };

  const onSubmitLoan = handleSubmit(async (data) => {
    try {
      await apiFetch('/api/v1/loans', { method: 'POST', body: data });
      success(t('loans.modals.addTitle'), { message: 'Loan recorded.' });
      setShowModal(false);
      reset();
      fetchLoans();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  const onSubmitPayment = payForm.handleSubmit(async (data) => {
    if (!showPaymentModal) return;
    try {
      await apiFetch(`/api/v1/loans/${showPaymentModal}/payments`, {
        method: 'POST',
        body: data,
      });
      success(t('loans.modals.paymentTitle'), { message: 'Payment recorded.' });
      setPayments(p => { const n = { ...p }; delete n[showPaymentModal]; return n; });
      setShowPaymentModal(null);
      payForm.reset();
      fetchLoans();
      fetchPayments(showPaymentModal);
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  const handleDelete = async (id: number, force = false) => {
    try {
      await apiFetch(`/api/v1/loans/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
      success('Deleted', { message: 'Loan removed.' });
      setDeleteConfirm(null);
      fetchLoans();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  const totalLent = loans.filter(l => l.loan_type === 'lent').reduce((s, l) => s + parseFloat(l.principal), 0);
  const totalBorrowed = loans.filter(l => l.loan_type === 'borrowed').reduce((s, l) => s + parseFloat(l.principal), 0);
  const netBalance = totalLent - totalBorrowed;

  const filtered = loans.filter(l => {
    if (filterType === 'lent') return l.loan_type === 'lent';
    if (filterType === 'borrowed') return l.loan_type === 'borrowed';
    if (filterType === 'settled') return l.status === 'settled';
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('loans.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('loans.description')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm"
        >
          {t('loans.addEntry')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label={t('loans.totalLent')} value={abbreviateVND(totalLent)} color="text-green-400" />
        <SummaryCard label={t('loans.totalBorrowed')} value={abbreviateVND(totalBorrowed)} color="text-red-400" />
        <SummaryCard
          label={t('loans.netBalance')}
          value={abbreviateVND(Math.abs(netBalance))}
          color={netBalance >= 0 ? 'text-green-400' : 'text-red-400'}
          sub={netBalance >= 0 ? t('loans.netBalancePositive') : t('loans.netBalanceNegative')}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {['all', 'lent', 'borrowed', 'settled'].map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setFilterType(tabKey)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === tabKey
              ? 'bg-green-500 text-black'
              : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
              }`}
          >
            {tabKey === 'all' ? t('loans.allLoans') : t(`enums.loanTypes.${tabKey}` as any, { defaultValue: tabKey.charAt(0).toUpperCase() + tabKey.slice(1) })}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-[#111] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('loans.noLoans')}
          description={t('loans.noLoansDesc')}
          action={{ label: t('loans.addEntry'), onClick: () => setShowModal(true) }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-[#111] border border-[#222] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222] text-gray-400 text-xs uppercase tracking-widest">
                  <th className="px-4 py-3 text-left">{t('loans.table.recipient')}</th>
                  <th className="px-4 py-3 text-right">{t('loans.table.principal')}</th>
                  <th className="px-4 py-3 text-right">{t('loans.table.remaining')}</th>
                  <th className="px-4 py-3 text-left">{t('loans.table.dateIssued')}</th>
                  <th className="px-4 py-3 text-left">{t('loans.table.dueDate')}</th>
                  <th className="px-4 py-3 text-left">{t('loans.table.status')}</th>
                  <th className="px-4 py-3 text-left">{t('loans.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(loan => (
                  <React.Fragment key={loan.id}>
                    <tr
                      className="border-b border-[#1a1a1a] hover:bg-[#161616] cursor-pointer"
                      onClick={() => toggleExpand(loan.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{loan.counterparty_name}</div>
                        <div className="text-xs text-gray-500 capitalize">
                          {t(`enums.loanTypes.${loan.loan_type}` as any, { defaultValue: loan.loan_type })}
                          {loan.interest_rate && (
                            <span className="ml-2 text-green-500/70">
                              • {loan.interest_type === 'percentage' ? `${loan.interest_rate}%` : abbreviateVND(parseFloat(loan.interest_rate))}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono">
                        {abbreviateVND(parseFloat(loan.principal))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={parseFloat(loan.remaining_balance) > 0 ? 'text-amber-400' : 'text-gray-500'}>
                          {abbreviateVND(parseFloat(loan.remaining_balance))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{loan.date_issued}</td>
                      <td className="px-4 py-3 text-gray-300">{loan.expected_due_date}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={loan.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { setShowPaymentModal(loan.id); payForm.reset(); }}
                            className="text-xs text-green-400 hover:text-green-300 border border-green-800 rounded px-2 py-1"
                          >
                            {t('loans.modals.paymentTitle')}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(loan.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === loan.id && (
                      <tr className="bg-[#0d0d0d]">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">{t('loans.history')}</div>
                          {payments[loan.id] ? (
                            payments[loan.id].length === 0 ? (
                              <div className="text-gray-500 text-sm">{t('loans.noHistory')}</div>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="text-left py-1">{t('loans.table.dueDate')}</th>
                                    <th className="text-right py-1">{t('loans.table.scheduled')}</th>
                                    <th className="text-right py-1">{t('loans.table.paid')}</th>
                                    <th className="text-left py-1">{t('loans.table.status')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payments[loan.id].map(p => (
                                    <tr key={p.id} className="border-t border-[#1a1a1a]">
                                      <td className="py-1 text-gray-300">{p.due_date}</td>
                                      <td className="py-1 text-right text-gray-300 font-mono">
                                        {abbreviateVND(parseFloat(p.scheduled_amount))}
                                      </td>
                                      <td className="py-1 text-right text-white font-mono">
                                        {abbreviateVND(parseFloat(p.paid_amount))}
                                      </td>
                                      <td className="py-1"><StatusPill status={p.status} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )
                          ) : (
                            <div className="text-gray-500 text-sm">{t('common.loading')}</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="lg:hidden space-y-4">
            {filtered.map(loan => {
              const isExpanded = expandedId === loan.id;
              return (
                <div key={loan.id} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
                  <div className="p-4 space-y-3" onClick={() => toggleExpand(loan.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-white">{loan.counterparty_name}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">
                          {t(`enums.loanTypes.${loan.loan_type}` as any, { defaultValue: loan.loan_type })}
                        </div>
                      </div>
                      <StatusPill status={loan.status} className="scale-90 origin-right" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t('loans.table.principal')}</div>
                        <div className="text-sm font-mono text-white">{abbreviateVND(parseFloat(loan.principal))}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">{t('loans.table.remaining')}</div>
                        <div className={`text-sm font-mono ${parseFloat(loan.remaining_balance) > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                          {abbreviateVND(parseFloat(loan.remaining_balance))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a]">
                      <div className="text-[10px] text-gray-500">
                        {t('loans.table.dueDate')}: <span className="text-gray-300">{loan.expected_due_date}</span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowPaymentModal(loan.id); payForm.reset(); }}
                          className="text-[11px] font-bold text-green-400"
                        >
                          {t('loans.modals.paymentTitle').toUpperCase()}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(loan.id); }}
                          className="text-[11px] font-bold text-red-500"
                        >
                          {t('common.delete').toUpperCase()}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 py-3 bg-[#0d0d0d] border-t border-[#1a1a1a]">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t('loans.history')}</div>
                      {payments[loan.id] ? (
                        payments[loan.id].length === 0 ? (
                          <div className="text-gray-500 text-xs italic">{t('loans.noHistory')}</div>
                        ) : (
                          <div className="space-y-2">
                            {payments[loan.id].map(p => (
                              <div key={p.id} className="flex justify-between items-center text-xs">
                                <div>
                                  <div className="text-gray-300">{p.due_date}</div>
                                  <div className="text-[10px] text-gray-500"><StatusPill status={p.status} className="scale-75 origin-left" /></div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white font-mono">{abbreviateVND(parseFloat(p.paid_amount))}</div>
                                  <div className="text-[10px] text-gray-500 font-mono italic">{t('loans.table.scheduled')}: {abbreviateVND(parseFloat(p.scheduled_amount))}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="text-gray-500 text-xs">{t('common.loading')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 text-xs text-gray-500 border-t border-[#1a1a1a]">
            {t('common.showing', { count: filtered.length, total: loans.length })}
          </div>
        </>
      )}

      {/* New Loan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-white">{t('loans.modals.addTitle')}</h2>
              <button onClick={() => { setShowModal(false); reset(); }} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">{t('loans.modals.desc')}</p>
            <form onSubmit={onSubmitLoan} className="space-y-4">
              {/* Transaction type toggle */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.type')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['lent', 'borrowed'] as const).map(t_key => (
                    <button
                      key={t_key}
                      type="button"
                      onClick={() => setValue('loan_type', t_key)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${loanType === t_key ? 'bg-green-500 text-black' : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#222]'
                        }`}
                    >
                      {t_key === 'lent' ? t('loans.modals.lent') : t('loans.modals.borrowed')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.counterparty')}</label>
                  <input {...register('counterparty_name')} placeholder="..."
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600" />
                  {errors.counterparty_name && <p className="text-red-400 text-xs mt-1">{errors.counterparty_name.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.principal')}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('principal', v)}
                    value={watch('principal')}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.principal && <p className="text-red-400 text-xs mt-1">{errors.principal.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.table.dateIssued')}</label>
                  <input type="date" {...register('date_issued')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                  {errors.date_issued && <p className="text-red-400 text-xs mt-1">{errors.date_issued.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.table.dueDate')}</label>
                  <input type="date" {...register('expected_due_date')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                  {errors.expected_due_date && <p className="text-red-400 text-xs mt-1">{errors.expected_due_date.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.terms')}</label>
                  <input {...register('repayment_terms')} placeholder={t('loans.modals.termsPlaceholder')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.interestRate')}</label>
                  <div className="relative">
                    <input
                      {...register('interest_rate')}
                      placeholder="0"
                      className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 pr-12 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 border-l border-[#333] pl-2">
                      <select
                        {...register('interest_type')}
                        className="bg-transparent border-none text-[11px] font-bold uppercase text-green-500 focus:outline-none cursor-pointer appearance-none hover:text-green-400"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">₫</option>
                      </select>
                    </div>
                  </div>
                  {errors.interest_rate && <p className="text-red-400 text-xs mt-1">{errors.interest_rate.message}</p>}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.notes')}</label>
                <textarea {...register('description')} rows={3} placeholder="..."
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600 resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button type="submit"
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2 rounded-lg text-sm">
                  {t('loans.modals.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{t('loans.modals.paymentTitle')}</h2>
              <button onClick={() => setShowPaymentModal(null)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={onSubmitPayment} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.paidAmount')}</label>
                <VNDInput
                  onChange={(v: string) => payForm.setValue('paid_amount', v)}
                  value={payForm.watch('paid_amount')}
                  placeholder="0.00"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                />
                {payForm.formState.errors.paid_amount && (
                  <p className="text-red-400 text-xs mt-1">{payForm.formState.errors.paid_amount.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.paymentDate')}</label>
                <input type="date" {...payForm.register('due_date')}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
                {payForm.formState.errors.due_date && (
                  <p className="text-red-400 text-xs mt-1">{payForm.formState.errors.due_date.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('loans.modals.paymentNotes')}</label>
                <input {...payForm.register('notes')} placeholder="..."
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(null)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button type="submit"
                  className="bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2 rounded-lg text-sm">
                  {t('loans.modals.recordPayment')}
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
            <h2 className="text-lg font-bold text-white mb-2">{t('loans.modals.deleteTitle')}</h2>
            <p className="text-sm text-gray-400 mb-4">
              {t('loans.modals.deleteDesc')}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm, false)}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded-lg">
                {t('loans.modals.deleteSafe')}
              </button>
              <button onClick={() => handleDelete(deleteConfirm, true)}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-400 text-white rounded-lg font-semibold">
                {t('loans.modals.deleteForce')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

