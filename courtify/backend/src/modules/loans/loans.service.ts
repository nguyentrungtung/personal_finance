import { BusinessRuleError } from '../../shared/errors.js';
import type { LoansRepository } from './loans.repository.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { DashboardService } from '../dashboard/dashboard.service.js';
import type { CreateLoanDto, UpdateLoanDto, ListLoansParams } from './loans.types.js';

const LIQUIDITY_ASSET_CLASS_ID = 3; // loans affect liquidity class

export class LoansService {
  constructor(
    private readonly repo: LoansRepository,
    private readonly ledger: LedgerService,
    private readonly dashboard: DashboardService,
  ) {}

  listAll(params: ListLoansParams = {}) {
    return this.repo.findAll(params).map(r => ({
      ...r,
      status: r.computed_status,
      remaining_balance: String((r.remaining_balance as number).toFixed(4)),
    }));
  }

  getById(id: number) {
    const row = this.repo.findByIdOrThrow(id);
    return { ...row, remaining_balance: String(row.remaining_balance.toFixed(4)) };
  }

  create(data: CreateLoanDto) {
    const loanId = this.repo.create(data);
    this.dashboard.upsertSnapshot();

    // lent = tiền ra (-), borrowed = tiền vào (+)
    const isLent = data.loan_type === 'lent';
    this.ledger.autoEntry({
      source_module: 'loans',
      source_id: loanId,
      asset_class_id: LIQUIDITY_ASSET_CLASS_ID,
      entry_type: 'loan_repayment',
      description: isLent
        ? `Cho vay — ${data.counterparty_name}`
        : `Vay — ${data.counterparty_name}`,
      amount: isLent
        ? String(-Math.round(parseFloat(data.principal)))
        : String(Math.round(parseFloat(data.principal))),
      transaction_date: data.date_issued,
      notes: data.description ?? data.repayment_terms,
    });

    return this.getById(loanId);
  }

  update(id: number, data: UpdateLoanDto) {
    this.repo.findByIdOrThrow(id);
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];

    if (data.loan_type !== undefined) { sets.push('loan_type = ?'); vals.push(data.loan_type); }
    if (data.counterparty_name !== undefined) { sets.push('counterparty_name = ?'); vals.push(data.counterparty_name); }
    if (data.principal !== undefined) { sets.push('principal = ?'); vals.push(data.principal); }
    if (data.date_issued !== undefined) { sets.push('date_issued = ?'); vals.push(data.date_issued); }
    if (data.expected_due_date !== undefined) { sets.push('expected_due_date = ?'); vals.push(data.expected_due_date); }
    if (data.repayment_terms !== undefined) { sets.push('repayment_terms = ?'); vals.push(data.repayment_terms); }
    if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description); }
    if (data.interest_rate !== undefined) { sets.push('interest_rate = ?'); vals.push(data.interest_rate); }
    if (data.interest_type !== undefined) { sets.push('interest_type = ?'); vals.push(data.interest_type); }

    const updated = this.repo.update(id, sets, vals);
    this.dashboard.upsertSnapshot();
    return { ...updated, remaining_balance: String(updated.remaining_balance.toFixed(4)) };
  }

  delete(id: number, force = false): { id: number; deleted: boolean } {
    this.repo.findByIdOrThrow(id);
    const paymentsCount = this.repo.countPayments(id);
    if (paymentsCount > 0 && !force) {
      throw new BusinessRuleError('Cannot delete loan with existing payments. Use force=true to override.', 'HAS_PAYMENTS');
    }
    this.repo.deletePayments(id);
    this.repo.delete(id);
    this.ledger.softDeleteAutoEntries('loans', id);
    this.dashboard.upsertSnapshot();
    return { id, deleted: true };
  }

  listPayments(loanId: number) {
    this.repo.findByIdOrThrow(loanId);
    return this.repo.listPayments(loanId);
  }

  addPayment(loanId: number, data: {
    paid_amount: string; due_date: string; scheduled_amount?: string; notes?: string;
  }) {
    const loan = this.getById(loanId);
    const remaining = parseFloat(loan.remaining_balance as string);
    const paid = parseFloat(data.paid_amount);

    if (paid > remaining + 0.0001) {
      throw new BusinessRuleError(
        `Payment amount ${paid} exceeds remaining balance ${remaining}`,
        'OVERPAYMENT',
      );
    }

    const paymentId = this.repo.addPayment(loanId, data);

    const newRemaining = remaining - paid;
    if (newRemaining <= 0.0001) {
      this.repo.settleLoan(loanId);
      this.repo.createLoanSettledEvent(loanId, data.due_date);
    }

    this.dashboard.upsertSnapshot();

    const isLent = (loan.loan_type as string) === 'lent';
    this.ledger.autoEntry({
      source_module: 'loans',
      source_id: paymentId,
      asset_class_id: LIQUIDITY_ASSET_CLASS_ID,
      entry_type: 'loan_repayment',
      description: isLent
        ? `Thu hồi nợ — ${loan.counterparty_name as string}`
        : `Trả nợ — ${loan.counterparty_name as string}`,
      amount: isLent
        ? String(Math.round(paid))
        : String(-Math.round(paid)),
      transaction_date: data.due_date,
      notes: data.notes,
    });

    return this.repo.getPaymentById(paymentId);
  }
}
