/**
 * Seed script — populates a fresh DB with realistic demo data.
 * Run standalone: pnpm seed
 * Called automatically by server.ts on first boot when DB is empty.
 *
 * Seeding order respects FK constraints:
 * users → institutions → asset_classes (already in migration) →
 * ledger_entries → savings_instruments → metals_holdings →
 * asset_lots → loans → loan_payments → net_worth_snapshots
 */

import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { getDb } from './client.js';

export async function runSeed(db: Database.Database): Promise<void> {
  console.warn('[seed] Seeding database…');

  const INIT_EMAIL = process.env.INIT_EMAIL ?? 'admin@example.com';
  const INIT_PASSWORD = process.env.INIT_PASSWORD ?? 'changeme123!';

  // ── Users ─────────────────────────────────────────────────────────
  const existingUser = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (!existingUser) {
    const passwordHash = await bcrypt.hash(INIT_PASSWORD, 12);
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, professional_title)
      VALUES (?, ?, 'Nguyen Van A', 'Portfolio Manager')
    `).run(INIT_EMAIL, passwordHash);
    console.warn(`[seed] Created user: ${INIT_EMAIL}`);
  }

  // ── Institutions ──────────────────────────────────────────────────
  const institutions = [
    { name: 'Vietcombank', type: 'bank', channels: '["liquidity", "metals"]' },
    { name: 'Techcombank', type: 'bank', channels: '["liquidity", "markets", "metals"]' },
    { name: 'MB Bank', type: 'bank', channels: '["liquidity"]' },
    { name: 'VPBank', type: 'bank', channels: '["liquidity"]' },
    { name: 'BIDV', type: 'bank', channels: '["liquidity"]' },
    { name: 'VietinBank', type: 'bank', channels: '["liquidity"]' },
    { name: 'ACB', type: 'bank', channels: '["liquidity"]' },
    { name: 'TPBank', type: 'bank', channels: '["liquidity"]' },
    { name: 'SSI', type: 'brokerage', channels: '["markets"]' },
    { name: 'VNDirect', type: 'brokerage', channels: '["markets"]' },
    { name: 'TCBS', type: 'brokerage', channels: '["markets", "liquidity"]' },
    { name: 'VPS', type: 'brokerage', channels: '["markets"]' },
    { name: 'HSC', type: 'brokerage', channels: '["markets"]' },
    { name: 'Binance', type: 'crypto_exchange', channels: '["markets"]' },
    { name: 'OKX', type: 'crypto_exchange', channels: '["markets"]' },
    { name: 'Bybit', type: 'crypto_exchange', channels: '["markets"]' },
    { name: 'Remitano', type: 'crypto_exchange', channels: '["markets"]' },
    { name: 'SJC', type: 'gold_silver', channels: '["metals"]' },
    { name: 'PNJ', type: 'gold_silver', channels: '["metals"]' },
    { name: 'DOJI', type: 'gold_silver', channels: '["metals"]' },
    { name: 'Bảo Tín Minh Châu', type: 'gold_silver', channels: '["metals"]' },
    { name: 'Vinhomes', type: 'real_estate', channels: '["real_estate"]' },
    { name: 'Masterise Homes', type: 'real_estate', channels: '["real_estate"]' },
    { name: 'Nam Long Group', type: 'real_estate', channels: '["real_estate"]' },
  ];
  const insertInst = db.prepare(
    'INSERT OR IGNORE INTO institutions (name, type, supported_channels) VALUES (?, ?, ?)'
  );
  for (const inst of institutions) {
    insertInst.run(inst.name, inst.type, inst.channels);
  }

  const instMap = Object.fromEntries(
    (db.prepare('SELECT id, name FROM institutions').all() as { id: number; name: string }[]).map(
      (r) => [r.name, r.id]
    )
  );

  const acMap = Object.fromEntries(
    (db.prepare('SELECT id, code FROM asset_classes').all() as { id: number; code: string }[]).map(
      (r) => [r.code, r.id]
    )
  );

  // ── Ledger entries ────────────────────────────────────────────────
  const ledgerRows = [
    { asset_class_id: acMap['real_estate'], institution_id: instMap['Techcombank'], entry_type: 'real_estate_appraisal', description: 'Apartment District 2 appraisal', amount: '4500000000.0000', status: 'appraisal', transaction_date: '2026-03-15T07:00:00.000Z' },
    { asset_class_id: acMap['liquidity'], institution_id: instMap['Techcombank'], entry_type: 'savings_deposit', description: 'Emergency fund top-up', amount: '200000000.0000', status: 'completed', transaction_date: '2026-04-01T07:00:00.000Z' },
    { asset_class_id: acMap['markets'], institution_id: instMap['VNDirect'], entry_type: 'crypto_purchase', description: 'FPT stock purchase', amount: '-150000000.0000', status: 'completed', transaction_date: '2026-04-10T07:00:00.000Z' },
    { asset_class_id: acMap['markets'], institution_id: instMap['Binance'], entry_type: 'crypto_purchase', description: 'BTC purchase', amount: '-300000000.0000', status: 'completed', transaction_date: '2026-04-15T07:00:00.000Z' },
    { asset_class_id: acMap['liquidity'], institution_id: instMap['VPBank'], entry_type: 'savings_deposit', description: 'Monthly savings transfer', amount: '50000000.0000', status: 'completed', transaction_date: '2026-04-20T07:00:00.000Z' },
    { asset_class_id: acMap['real_estate'], institution_id: null, entry_type: 'real_estate_appraisal', description: 'Land Binh Duong valuation', amount: '2200000000.0000', status: 'appraisal', transaction_date: '2026-04-22T07:00:00.000Z' },
    { asset_class_id: acMap['metals'], institution_id: instMap['Techcombank'], entry_type: 'other', description: 'Gold storage fee', amount: '-500000.0000', status: 'completed', transaction_date: '2026-04-25T07:00:00.000Z' },
    { asset_class_id: acMap['liquidity'], institution_id: instMap['Techcombank'], entry_type: 'tax_transfer', description: 'Personal income tax Q1', amount: '-85000000.0000', status: 'cleared', transaction_date: '2026-03-30T07:00:00.000Z' },
    { asset_class_id: acMap['markets'], institution_id: instMap['VNDirect'], entry_type: 'crypto_purchase', description: 'VIC stock purchase', amount: '-200000000.0000', status: 'completed', transaction_date: '2026-05-02T07:00:00.000Z' },
    { asset_class_id: acMap['liquidity'], institution_id: instMap['VPBank'], entry_type: 'savings_deposit', description: 'Q2 bonus savings', amount: '120000000.0000', status: 'pending', transaction_date: '2026-05-10T07:00:00.000Z' },
    { asset_class_id: acMap['real_estate'], institution_id: null, entry_type: 'other', description: 'Maintenance reserve District 2', amount: '-15000000.0000', status: 'completed', transaction_date: '2026-05-01T07:00:00.000Z' },
    { asset_class_id: acMap['metals'], institution_id: instMap['Techcombank'], entry_type: 'other', description: 'Silver bullion purchase', amount: '-45000000.0000', status: 'completed', transaction_date: '2026-04-05T07:00:00.000Z' },
    { asset_class_id: acMap['markets'], institution_id: instMap['SSI'], entry_type: 'crypto_purchase', description: 'HPG stock purchase', amount: '-75000000.0000', status: 'completed', transaction_date: '2026-03-20T07:00:00.000Z' },
    { asset_class_id: acMap['liquidity'], institution_id: instMap['Techcombank'], entry_type: 'savings_deposit', description: 'Salary deposit', amount: '85000000.0000', status: 'completed', transaction_date: '2026-05-05T07:00:00.000Z' },
    { asset_class_id: acMap['markets'], institution_id: instMap['Binance'], entry_type: 'crypto_purchase', description: 'ETH purchase', amount: '-120000000.0000', status: 'completed', transaction_date: '2026-03-10T07:00:00.000Z' },
    { asset_class_id: acMap['liquidity'], institution_id: instMap['VPBank'], entry_type: 'loan_repayment', description: 'Car loan repayment', amount: '-22000000.0000', status: 'completed', transaction_date: '2026-04-30T07:00:00.000Z' },
    { asset_class_id: acMap['real_estate'], institution_id: null, entry_type: 'real_estate_appraisal', description: 'Commercial space Quan 1 valuation', amount: '8500000000.0000', status: 'appraisal', transaction_date: '2026-02-28T07:00:00.000Z' },
    { asset_class_id: acMap['metals'], institution_id: null, entry_type: 'other', description: 'Gold bar purchase', amount: '-380000000.0000', status: 'completed', transaction_date: '2026-02-15T07:00:00.000Z' },
    { asset_class_id: acMap['markets'], institution_id: instMap['VNDirect'], entry_type: 'crypto_purchase', description: 'ACB stock purchase', amount: '-95000000.0000', status: 'completed', transaction_date: '2026-01-20T07:00:00.000Z' },
    { asset_class_id: acMap['liquidity'], institution_id: instMap['Techcombank'], entry_type: 'savings_deposit', description: 'Year-end bonus allocation', amount: '250000000.0000', status: 'completed', transaction_date: '2025-12-31T07:00:00.000Z' },
  ];
  const insertLedger = db.prepare(`
    INSERT OR IGNORE INTO ledger_entries
      (asset_class_id, institution_id, entry_type, description, amount, status, transaction_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of ledgerRows) {
    insertLedger.run(row.asset_class_id, row.institution_id ?? null, row.entry_type, row.description, row.amount, row.status, row.transaction_date);
  }

  // ── Savings instruments ───────────────────────────────────────────
  const savings = [
    { institution_id: instMap['Techcombank'], label: 'TCB 12-month CD', instrument_type: 'certificate_of_deposit', principal: '500000000.0000', interest_rate: '7.5000', start_date: '2026-01-01', maturity_date: '2027-01-01', status: 'active' },
    { institution_id: instMap['VPBank'], label: 'VPB Savings Account', instrument_type: 'savings_account', principal: '200000000.0000', interest_rate: '5.2000', start_date: '2026-03-01', maturity_date: '2026-09-01', status: 'active' },
    { institution_id: instMap['Techcombank'], label: 'TCB T-Bond 2Y', instrument_type: 'treasury_bond', principal: '1000000000.0000', interest_rate: '8.1000', start_date: '2025-06-01', maturity_date: '2027-06-01', status: 'active' },
  ];
  const insertSavings = db.prepare(`
    INSERT OR IGNORE INTO savings_instruments
      (institution_id, label, instrument_type, principal, interest_rate, start_date, maturity_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of savings) {
    insertSavings.run(s.institution_id, s.label, s.instrument_type, s.principal, s.interest_rate, s.start_date, s.maturity_date, s.status);
  }

  // ── Metals holdings ───────────────────────────────────────────────
  const metals = [
    { metal_type: 'gold', label: 'SJC Gold Bar 5 lượng', weight_grams: '187.5000', weight_display: '5', weight_unit: 'luong', purity: '99.9900', purchase_price_per_gram: '2200000.0000', current_price_per_gram: '2450000.0000', purchase_date: '2024-06-15', institution_id: instMap['Techcombank'] },
    { metal_type: 'gold', label: 'PNJ Gold Ring', weight_grams: '7.5000', weight_display: '2', weight_unit: 'chi', purity: '75.0000', purchase_price_per_gram: '1800000.0000', current_price_per_gram: '2000000.0000', purchase_date: '2025-01-10', institution_id: null },
    { metal_type: 'silver', label: 'Silver bullion 100g', weight_grams: '100.0000', weight_display: '100', weight_unit: 'gram', purity: '99.9000', purchase_price_per_gram: '22000.0000', current_price_per_gram: '25000.0000', purchase_date: '2025-08-20', institution_id: null },
    { metal_type: 'gold', label: 'Gold savings - Techcom', weight_grams: '37.5000', weight_display: '1', weight_unit: 'luong', purity: '99.9900', purchase_price_per_gram: '2100000.0000', current_price_per_gram: '2450000.0000', purchase_date: '2023-12-01', institution_id: instMap['Techcombank'] },
    { metal_type: 'silver', label: 'Silver bars collection', weight_grams: '500.0000', weight_display: '500', weight_unit: 'gram', purity: '99.9000', purchase_price_per_gram: '20000.0000', current_price_per_gram: '25000.0000', purchase_date: '2024-03-15', institution_id: null },
  ];
  const insertMetal = db.prepare(`
    INSERT OR IGNORE INTO metals_holdings
      (metal_type, label, weight_grams, weight_display, weight_unit, purity,
       purchase_price_per_gram, current_price_per_gram, purchase_date, institution_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const m of metals) {
    insertMetal.run(m.metal_type, m.label, m.weight_grams, m.weight_display, m.weight_unit, m.purity, m.purchase_price_per_gram, m.current_price_per_gram, m.purchase_date, m.institution_id ?? null);
  }

  // ── Loans ─────────────────────────────────────────────────────────
  const loans = [
    { loan_type: 'lent', counterparty_name: 'Le Van Nam', description: 'Personal loan for house down payment', principal: '50000000.0000', date_issued: '2026-02-01', expected_due_date: '2026-08-01', repayment_terms: '3 installments, no interest', status: 'active' },
    { loan_type: 'borrowed', counterparty_name: 'MB Bank', description: 'Car loan', principal: '300000000.0000', date_issued: '2024-06-01', expected_due_date: '2027-06-01', repayment_terms: '36 monthly installments at 8.5% p.a.', status: 'active' },
    { loan_type: 'lent', counterparty_name: 'Tran Thi Mai', description: 'Business startup loan', principal: '100000000.0000', date_issued: '2025-10-01', expected_due_date: '2026-04-01', repayment_terms: '6 monthly installments', status: 'overdue' },
  ];
  const insertLoan = db.prepare(`
    INSERT OR IGNORE INTO loans
      (loan_type, counterparty_name, description, principal, date_issued, expected_due_date, repayment_terms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const l of loans) {
    insertLoan.run(l.loan_type, l.counterparty_name, l.description, l.principal, l.date_issued, l.expected_due_date, l.repayment_terms, l.status);
  }

  const loan1 = db.prepare("SELECT id FROM loans WHERE counterparty_name='Le Van Nam' LIMIT 1").get() as { id: number } | undefined;
  const loan2 = db.prepare("SELECT id FROM loans WHERE counterparty_name='MB Bank' LIMIT 1").get() as { id: number } | undefined;
  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO loan_payments (loan_id, scheduled_amount, due_date, paid_amount, paid_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  if (loan1) {
    insertPayment.run(loan1.id, '16666666.6700', '2026-04-01', '16666666.6700', '2026-03-28', 'paid');
    insertPayment.run(loan1.id, '16666666.6700', '2026-06-01', '0.0000', null, 'scheduled');
    insertPayment.run(loan1.id, '16666666.6600', '2026-08-01', '0.0000', null, 'scheduled');
  }
  if (loan2) {
    insertPayment.run(loan2.id, '9583333.3300', '2026-03-01', '9583333.3300', '2026-03-01', 'paid');
    insertPayment.run(loan2.id, '9583333.3300', '2026-04-01', '9583333.3300', '2026-04-01', 'paid');
    insertPayment.run(loan2.id, '9583333.3300', '2026-05-01', '9583333.3300', '2026-05-01', 'paid');
    insertPayment.run(loan2.id, '9583333.3300', '2026-06-01', '0.0000', null, 'scheduled');
    insertPayment.run(loan2.id, '9583333.3300', '2026-07-01', '0.0000', null, 'scheduled');
    insertPayment.run(loan2.id, '9583333.3300', '2026-08-01', '0.0000', null, 'scheduled');
  }

  // ── Investment lots & transactions ───────────────────────────────
  // asset_class IDs: metals=1, markets=2, liquidity=3, real_estate=4
  //
  // Scenario design:
  //   • FPT stock  – 2 DCA lots (cả 2 đang active) → minh hoạ chiến lược trung bình giá
  //   • VIC stock  – 1 lot, đã bán một phần (partial_closed) → minh hoạ chốt lời từng phần
  //   • ACB stock  – 1 lot, đã bán hết (closed) → minh hoạ lịch sử lô đã đóng
  //   • HPG stock  – 1 lot active → đang lỗ nhẹ, minh hoạ risk
  //   • BTC crypto – 2 DCA lots (lot 2 mua giá cao hơn) → minh hoạ DCA crypto
  //   • ETH crypto – 1 lot active
  //   • DCVFMVN30 ETF – 1 lot (markets/etf) → minh hoạ ETF
  //   • VFMVF4 mutual fund – 1 lot (liquidity/mutual_fund)
  //   • District 2 apt – 1 real_estate lot

  const insertLot = db.prepare(`
    INSERT OR IGNORE INTO asset_lots
      (asset_class_id, asset_name, asset_subtype, institution_id, purchase_date,
       original_volume, remaining_volume, buy_price_per_unit, current_price_per_unit,
       unit_label, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTxn = db.prepare(`
    INSERT OR IGNORE INTO asset_transactions
      (lot_id, transaction_type, transaction_date, volume, price_per_unit, fee, net_amount, realized_pnl, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Helper: insert lot + buy transaction, return lot id
  function seedLot(
    assetClassId: number, assetName: string, assetSubtype: string,
    institutionId: number | null, purchaseDate: string,
    volume: string, buyPrice: string, currentPrice: string,
    unitLabel: string, status: string, notes: string | null,
    fee: string
  ): number {
    insertLot.run(assetClassId, assetName, assetSubtype, institutionId, purchaseDate,
      volume, volume, buyPrice, currentPrice, unitLabel, status, notes);
    const lot = db.prepare(
      'SELECT id FROM asset_lots WHERE asset_name=? AND purchase_date=? AND buy_price_per_unit=? LIMIT 1'
    ).get(assetName, purchaseDate, buyPrice) as { id: number } | undefined;
    if (!lot) return 0;
    // Buy transaction: net_amount = -(volume * price + fee)
    const gross = parseFloat(volume) * parseFloat(buyPrice);
    const netAmount = -(gross + parseFloat(fee));
    insertTxn.run(lot.id, 'buy', purchaseDate, volume, buyPrice, fee,
      netAmount.toFixed(4), null, null);
    return lot.id;
  }

  // ── Tab: Cổ phiếu/Crypto (asset_class_id=2, markets) ─────────────

  // FPT - Lô 1: mua 100 cp @ 95,000 (6/2025) → DCA đợt 1
  seedLot(2, 'FPT', 'stock', instMap['SSI'], '2025-06-15',
    '100', '95000', '128000', 'cp', 'active',
    'DCA đợt 1 - mua đáy sau điều chỉnh', '142500');

  // FPT - Lô 2: mua 200 cp @ 108,000 (11/2025) → DCA đợt 2 (giá cao hơn)
  seedLot(2, 'FPT', 'stock', instMap['SSI'], '2025-11-20',
    '200', '108000', '128000', 'cp', 'active',
    'DCA đợt 2 - tăng vị thế', '324000');

  // VIC - Lô 1: mua 500 cp @ 45,000 (3/2025), bán 200 cp @ 55,000 (1/2026)
  const vicId = seedLot(2, 'VIC', 'stock', instMap['VNDirect'], '2025-03-10',
    '500', '45000', '58000', 'cp', 'partial_closed',
    'Chốt lời 40% vị thế khi giá tăng 22%', '337500');
  if (vicId) {
    // Bán 200 cp @ 55,000: realized P&L = (55000-45000)*200 - fee
    const sellFee = Math.round(200 * 55000 * 0.0015);   // 16,500
    const sellNet = 200 * 55000 - sellFee;               // 10,983,500
    const pnl = (55000 - 45000) * 200 - sellFee;        // 1,983,500
    db.prepare("UPDATE asset_lots SET remaining_volume=?, updated_at=datetime('now') WHERE id=?")
      .run('300', vicId);
    insertTxn.run(vicId, 'sell', '2026-01-20', '200', '55000',
      sellFee.toFixed(4), sellNet.toFixed(4), pnl.toFixed(4),
      'Chốt lời một phần, giữ lại 300 cp');
  }

  // ACB - Lô 1: mua 1000 cp @ 22,000 (8/2024), bán hết @ 28,500 (12/2025)
  const acbId = seedLot(2, 'ACB', 'stock', instMap['VNDirect'], '2024-08-05',
    '1000', '22000', '28500', 'cp', 'closed',
    'Đã chốt lời toàn bộ vị thế', '330000');
  if (acbId) {
    const sellFee = Math.round(1000 * 28500 * 0.0015);  // 42,750
    const sellNet = 1000 * 28500 - sellFee;              // 28,457,250
    const pnl = (28500 - 22000) * 1000 - sellFee;       // 6,457,250
    db.prepare("UPDATE asset_lots SET remaining_volume='0', status='closed', updated_at=datetime('now') WHERE id=?")
      .run(acbId);
    insertTxn.run(acbId, 'sell', '2025-12-10', '1000', '28500',
      sellFee.toFixed(4), sellNet.toFixed(4), pnl.toFixed(4),
      'Thoát hàng hoàn toàn, lãi 29.5%');
  }

  // HPG - Lô 1: mua 300 cp @ 33,000 (1/2026), giá hiện tại 29,500 → đang lỗ
  seedLot(2, 'HPG', 'stock', instMap['SSI'], '2026-01-08',
    '300', '33000', '29500', 'cp', 'active',
    'Ngành thép — chờ phục hồi Q2/2026', '148500');

  // BTC - Lô 1: mua 0.05 BTC @ 1,650,000,000 (1/2024)
  seedLot(2, 'BTC', 'crypto', instMap['Binance'], '2024-01-20',
    '0.05', '1650000000', '1920000000', 'BTC', 'active',
    'Entry đợt 1 - tích lũy dài hạn', '825000');

  // BTC - Lô 2: mua 0.03 BTC @ 2,150,000,000 (10/2025) → DCA, giá vào cao hơn
  seedLot(2, 'BTC', 'crypto', instMap['Binance'], '2025-10-05',
    '0.03', '2150000000', '1920000000', 'BTC', 'active',
    'DCA đợt 2 - lô này đang lỗ, chờ phục hồi', '645000');

  // ETH - Lô 1: mua 0.8 ETH @ 62,000,000 (6/2025)
  seedLot(2, 'ETH', 'crypto', instMap['Binance'], '2025-06-12',
    '0.8', '62000000', '75000000', 'ETH', 'active',
    'Staking yield ~4% APY', '496000');

  // DCVFMVN30 ETF (markets/etf): mua 5000 CCQ @ 14,500 (7/2025)
  seedLot(2, 'DCVFMVN30', 'etf', instMap['TCBS'], '2025-07-01',
    '5000', '14500', '16800', 'CCQ', 'active',
    'ETF mô phỏng VN30 Index', '362500');

  // ── Tab: Tiết kiệm/Quỹ (asset_class_id=3, liquidity) ─────────────

  // VFMVF4 mutual fund: mua 10,000 CCQ @ 12,800 (4/2025)
  seedLot(3, 'VFMVF4', 'mutual_fund', instMap['Techcombank'], '2025-04-10',
    '10000', '12800', '14600', 'CCQ', 'active',
    'Quỹ tăng trưởng VFM — phân phối cổ tức hàng năm', '640000');

  // VESAF Equity fund: mua 5000 CCQ @ 21,500 (9/2025)
  seedLot(3, 'VESAF', 'mutual_fund', instMap['Techcombank'], '2025-09-15',
    '5000', '21500', '23800', 'CCQ', 'active',
    'Quỹ cổ phiếu Việt Nam — danh mục đa dạng hoá', '537500');

  // ── Tab: Bất động sản (asset_class_id=4, real_estate) ────────────

  // Căn hộ Quận 2: mua 3,200,000,000 (5/2023), định giá hiện tại 4,500,000,000
  seedLot(4, 'Căn hộ Quận 2', 'real_estate', null, '2023-05-15',
    '1', '3200000000', '4500000000', 'căn', 'active',
    '2PN 68m² — đang cho thuê 18 triệu/tháng, yield ~6.75%/năm', '32000000');

  console.warn('[seed] Investment lots seeded ✓');

  // ── Net worth snapshots (12 months) ───────────────────────────────
  const upsertSnapshot = db.prepare(`
    INSERT INTO net_worth_snapshots
      (snapshot_date, total_vnd, metals_vnd, markets_vnd, liquidity_vnd, real_estate_vnd)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date) DO UPDATE SET
      total_vnd = excluded.total_vnd,
      metals_vnd = excluded.metals_vnd,
      markets_vnd = excluded.markets_vnd,
      liquidity_vnd = excluded.liquidity_vnd,
      real_estate_vnd = excluded.real_estate_vnd
  `);
  const snapshotData = [
    ['2025-05-01', '8500000000', '600000000', '800000000', '900000000', '6200000000'],
    ['2025-06-01', '8750000000', '620000000', '850000000', '950000000', '6330000000'],
    ['2025-07-01', '9100000000', '650000000', '920000000', '980000000', '6550000000'],
    ['2025-08-01', '9300000000', '670000000', '950000000', '1000000000', '6680000000'],
    ['2025-09-01', '9600000000', '700000000', '1000000000', '1050000000', '6850000000'],
    ['2025-10-01', '9850000000', '720000000', '1050000000', '1080000000', '7000000000'],
    ['2025-11-01', '10200000000', '750000000', '1100000000', '1150000000', '7200000000'],
    ['2025-12-01', '10500000000', '780000000', '1150000000', '1200000000', '7370000000'],
    ['2026-01-01', '10800000000', '810000000', '1200000000', '1250000000', '7540000000'],
    ['2026-02-01', '11100000000', '840000000', '1280000000', '1300000000', '7680000000'],
    ['2026-03-01', '11500000000', '870000000', '1350000000', '1380000000', '7900000000'],
    ['2026-04-01', '11800000000', '900000000', '1420000000', '1430000000', '8050000000'],
  ];
  for (const [date, total, m, mk, liq, re] of snapshotData) {
    upsertSnapshot.run(date, total, m, mk, liq, re);
  }

  // ── Default scheduled jobs (disabled until SMTP is configured) ───
  const insertJob = db.prepare(`
    INSERT OR IGNORE INTO scheduled_jobs (name, job_type, cron_expression, enabled)
    VALUES (?, ?, ?, 0)
  `);
  insertJob.run('Nhắc nhở sự kiện lịch', 'calendar_reminder', '30 8 * * *');
  insertJob.run('Dọn dẹp dữ liệu cũ', 'data_cleanup', '0 2 * * 0');
  insertJob.run('Báo cáo tổng hợp đêm', 'nightly_summary', '0 23 * * *');

  console.warn('[seed] Seed complete ✓');
}

// ── Standalone execution: pnpm seed ──────────────────────────────────────────
// Only runs when this file is executed directly, not when imported.
const isMain = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  const db = getDb();
  runSeed(db).catch((err) => {
    console.error('[seed] Seed failed:', err);
    process.exit(1);
  });
}
