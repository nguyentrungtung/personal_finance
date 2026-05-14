# Data Model: COURTIFY — Wealth Management Dashboard

**Feature**: `001-courtify-wealth-dashboard`
**Date**: 2026-05-14 (amended — PostgreSQL → SQLite; added users, loans, loan_payments)

**SQLite type conventions used throughout:**
- Monetary amounts → `TEXT` (decimal string, e.g. `"2450000.0000"`)
- Auto-increment PK → `INTEGER PRIMARY KEY AUTOINCREMENT`
- Timestamps → `TEXT` (ISO 8601 UTC, e.g. `"2026-05-14T07:00:00.000Z"`)
- Dates → `TEXT` (`YYYY-MM-DD`)
- Booleans → `INTEGER` (0 = false, 1 = true)
- Arrays/JSON → `TEXT` (JSON serialized, e.g. `"[1,7,30]"`)

`PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` are set at startup.

---

## Entities & Tables

### `users`

Single-row table for the authenticated user account.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | Always id=1 for single-user |
| `email` | `TEXT` | NOT NULL, UNIQUE | Login identifier |
| `password_hash` | `TEXT` | NOT NULL | bcryptjs hash (cost 12) |
| `full_name` | `TEXT` | NOT NULL | Display name in sidebar |
| `professional_title` | `TEXT` | | e.g. "Portfolio Manager" |
| `avatar_path` | `TEXT` | | Relative path under `/app/uploads/avatars/` |
| `totp_secret` | `TEXT` | | Base32 secret; NULL if 2FA not enabled |
| `totp_enabled` | `INTEGER` | NOT NULL DEFAULT 0 | 1 = 2FA active |
| `totp_recovery_codes` | `TEXT` | | JSON array of bcrypt-hashed recovery codes |
| `failed_login_attempts` | `INTEGER` | NOT NULL DEFAULT 0 | Reset on success |
| `locked_until` | `TEXT` | | ISO timestamp; NULL if not locked |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Business rule**: Account locked when `failed_login_attempts >= 5`; `locked_until` set to
`NOW() + 15 minutes`. Recovery code use clears `totp_enabled` and `totp_secret`.

---

### `institutions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `name` | `TEXT` | NOT NULL, UNIQUE | e.g. "Techcombank", "VNDirect" |
| `type` | `TEXT` | NOT NULL | `bank` \| `broker` \| `exchange` \| `other` |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

---

### `asset_classes`

Seed-data lookup; not user-editable.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `code` | `TEXT` | NOT NULL, UNIQUE | `metals` \| `markets` \| `liquidity` \| `real_estate` |
| `label` | `TEXT` | NOT NULL | Display name |
| `icon` | `TEXT` | | Icon identifier |

---

### `ledger_entries`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `asset_class_id` | `INTEGER` | NOT NULL, FK → asset_classes | |
| `institution_id` | `INTEGER` | FK → institutions (nullable) | |
| `entry_type` | `TEXT` | NOT NULL | `crypto_purchase` \| `real_estate_appraisal` \| `tax_transfer` \| `savings_deposit` \| `loan_repayment` \| `other` |
| `description` | `TEXT` | NOT NULL | |
| `amount` | `TEXT` | NOT NULL | Signed VND string (negative = outflow) |
| `status` | `TEXT` | NOT NULL DEFAULT `'completed'` | `completed` \| `pending` \| `appraisal` \| `cleared` |
| `transaction_date` | `TEXT` | NOT NULL | ISO 8601 timestamp |
| `attachment_path` | `TEXT` | | Relative path under `/app/uploads/` |
| `notes` | `TEXT` | | |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Indexes**: `(asset_class_id)`, `(status)`, `(transaction_date DESC)`, `(institution_id)`

---

### `savings_instruments`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `institution_id` | `INTEGER` | NOT NULL, FK → institutions | |
| `label` | `TEXT` | NOT NULL | User-given name |
| `instrument_type` | `TEXT` | NOT NULL | `savings_account` \| `certificate_of_deposit` \| `money_market` \| `treasury_bond` |
| `principal` | `TEXT` | NOT NULL | VND string, CHECK > 0 |
| `interest_rate` | `TEXT` | NOT NULL | Annual % string (e.g. `"7.5000"`) |
| `start_date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `maturity_date` | `TEXT` | NOT NULL | `YYYY-MM-DD`, must be after start_date |
| `status` | `TEXT` | NOT NULL DEFAULT `'active'` | `active` \| `matured` \| `withdrawn` |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Computed field** (at query time, not stored):
`accrued_interest = CAST(principal AS REAL) × (CAST(interest_rate AS REAL)/100) × (days_elapsed/365.0)`

**Indexes**: `(institution_id)`, `(maturity_date)`, `(status)`

---

### `asset_lots`

Tracks each individual acquisition lot for investable assets (stocks, crypto, mutual funds). Metals
are tracked separately in `metals_holdings` which follows the same lot-per-row display principle.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `asset_class_id` | `INTEGER` | NOT NULL, FK → asset_classes | `markets` for stocks/crypto/funds |
| `asset_name` | `TEXT` | NOT NULL | Ticker or product name (e.g. `"FPT"`, `"BTC"`, `"VFMVN30"`) |
| `asset_subtype` | `TEXT` | NOT NULL | `stock` \| `crypto` \| `mutual_fund` \| `etf` |
| `institution_id` | `INTEGER` | FK → institutions (nullable) | Broker/exchange |
| `purchase_date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `original_volume` | `TEXT` | NOT NULL | Shares/units at time of buy (e.g. `"1000.0000"`) |
| `remaining_volume` | `TEXT` | NOT NULL | Current unsold volume; decremented on SELL |
| `buy_price_per_unit` | `TEXT` | NOT NULL | VND per share/unit at purchase |
| `current_price_per_unit` | `TEXT` | NOT NULL | VND; user-updated via inline edit |
| `unit_label` | `TEXT` | NOT NULL DEFAULT `'shares'` | Display unit (e.g. `"shares"`, `"coins"`, `"certificates"`) |
| `status` | `TEXT` | NOT NULL DEFAULT `'active'` | `active` \| `partial_closed` \| `closed` |
| `notes` | `TEXT` | | |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Computed fields** (at query time):
- `total_buy_value = CAST(original_volume AS REAL) × CAST(buy_price_per_unit AS REAL)`
- `current_value = CAST(remaining_volume AS REAL) × CAST(current_price_per_unit AS REAL)`
- `unrealised_pnl = current_value − (CAST(remaining_volume AS REAL) × CAST(buy_price_per_unit AS REAL))`
- `pct_change = (current_price_per_unit − buy_price_per_unit) / buy_price_per_unit × 100`

**Aggregated view** (grouped by `asset_name`, status IN ('active','partial_closed')):
- `total_remaining_volume = SUM(remaining_volume)`
- `weighted_avg_cost = SUM(remaining_volume × buy_price_per_unit) / SUM(remaining_volume)`

**Indexes**: `(asset_class_id)`, `(asset_name)`, `(status)`, `(purchase_date ASC)` (for FIFO ordering)

---

### `asset_transactions`

Immutable event log for every BUY and SELL action on `asset_lots`. Never updated or deleted.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `lot_id` | `INTEGER` | NOT NULL, FK → asset_lots | Parent lot |
| `transaction_type` | `TEXT` | NOT NULL | `buy` \| `sell` \| `dividend` \| `split` |
| `transaction_date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `volume` | `TEXT` | NOT NULL | Positive for buy; positive for sell (direction from type) |
| `price_per_unit` | `TEXT` | NOT NULL | VND per unit at execution |
| `fee` | `TEXT` | NOT NULL DEFAULT `'0.0000'` | Transaction cost/tax in VND |
| `net_amount` | `TEXT` | NOT NULL | Signed VND cash flow: negative on BUY, positive on SELL |
| `realized_pnl` | `TEXT` | | VND; non-null on SELL; = (price_per_unit − lot.buy_price_per_unit) × volume |
| `notes` | `TEXT` | | |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Business rules**:
- BUY: creates the parent `asset_lots` row simultaneously (in same DB transaction).
- SELL (FIFO): a single sell order may generate **multiple** `asset_transactions` rows (one per
  consumed lot). The service layer runs `fifoMatch()` to determine lot consumption order, then
  writes each segment as a separate row. Lot `remaining_volume` is decremented atomically.
  - If `remaining_volume` reaches 0 → lot `status = 'closed'`
  - If `remaining_volume` decreases but > 0 → lot `status = 'partial_closed'`
- `realized_pnl` for each SELL segment: `(sell_price − lot_buy_price) × volume_sold_from_lot`
- DIVIDEND: `lot_id` references the lot in which the asset is held; `net_amount` = dividend received.
- Records are permanent — no soft-delete; correction is a compensating transaction.

**Indexes**: `(lot_id)`, `(transaction_type)`, `(transaction_date DESC)`

---

### `metals_holdings`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `metal_type` | `TEXT` | NOT NULL | `gold` \| `silver` |
| `label` | `TEXT` | | Optional description |
| `weight_grams` | `TEXT` | NOT NULL | Canonical stored unit (gram string) |
| `weight_display` | `TEXT` | NOT NULL | Original input weight string |
| `weight_unit` | `TEXT` | NOT NULL | `chi` \| `luong` \| `gram` |
| `purity` | `TEXT` | NOT NULL | e.g. `"99.9900"` (%) |
| `purchase_price_per_gram` | `TEXT` | NOT NULL | VND string |
| `current_price_per_gram` | `TEXT` | NOT NULL | VND string (user-updated) |
| `purchase_date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `institution_id` | `INTEGER` | FK → institutions (nullable) | |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Computed fields** (at query time):
- `purchase_value = CAST(weight_grams AS REAL) × CAST(purchase_price_per_gram AS REAL)`
- `current_value = CAST(weight_grams AS REAL) × CAST(current_price_per_gram AS REAL)`
- `unrealised_gain = current_value − purchase_value`

**Indexes**: `(metal_type)`, `(purchase_date)`

---

### `loans`

Personal lending and borrowing records.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `loan_type` | `TEXT` | NOT NULL | `lent` \| `borrowed` |
| `counterparty_name` | `TEXT` | NOT NULL | Name of person/entity |
| `description` | `TEXT` | | Purpose of loan |
| `principal` | `TEXT` | NOT NULL | Original VND amount string |
| `date_issued` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `expected_due_date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `repayment_terms` | `TEXT` | | Free-text: interest rate, schedule notes |
| `status` | `TEXT` | NOT NULL DEFAULT `'active'` | Computed: `active` \| `overdue` \| `settled` |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Computed fields** (at query time):
- `remaining_balance = CAST(principal AS REAL) − SUM(paid_amount from loan_payments where status='paid')`
- `status`: settled if remaining_balance ≤ 0; overdue if remaining_balance > 0 AND earliest
  unpaid payment due_date < date('now'); active otherwise

**Indexes**: `(loan_type)`, `(status)`, `(expected_due_date)`

---

### `loan_payments`

Installment records for each loan.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `loan_id` | `INTEGER` | NOT NULL, FK → loans | Cascade delete |
| `scheduled_amount` | `TEXT` | NOT NULL | VND string |
| `due_date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `paid_amount` | `TEXT` | DEFAULT `'0.0000'` | VND string; 0 until paid |
| `paid_date` | `TEXT` | | `YYYY-MM-DD`; NULL until paid |
| `status` | `TEXT` | NOT NULL DEFAULT `'scheduled'` | `scheduled` \| `paid` \| `overdue` |
| `notes` | `TEXT` | | |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Business rule**: `status` auto-transitions:
- `scheduled` → `paid` when `paid_date` is set
- `scheduled` → `overdue` when `due_date < date('now')` and `paid_date IS NULL`

**Validation**: `paid_amount` MUST NOT exceed the loan's remaining balance (enforced in service).

**Indexes**: `(loan_id)`, `(due_date)`, `(status)`

---

### `calendar_events`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `title` | `TEXT` | NOT NULL | |
| `event_type` | `TEXT` | NOT NULL | `maturity` \| `debt_due` \| `savings_goal` \| `loan_settled` \| `other` |
| `due_date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `amount` | `TEXT` | | VND string (optional) |
| `asset_class_id` | `INTEGER` | FK → asset_classes (nullable) | |
| `linked_savings_id` | `INTEGER` | FK → savings_instruments (nullable) | |
| `linked_loan_id` | `INTEGER` | FK → loans (nullable) | |
| `linked_ledger_id` | `INTEGER` | FK → ledger_entries (nullable) | |
| `notes` | `TEXT` | | |
| `is_dismissed` | `INTEGER` | NOT NULL DEFAULT 0 | |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Indexes**: `(due_date ASC)`, `(event_type)`, `(is_dismissed)`

---

### `net_worth_snapshots`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK AUTOINCREMENT | |
| `snapshot_date` | `TEXT` | NOT NULL, UNIQUE | `YYYY-MM-DD` |
| `total_vnd` | `TEXT` | NOT NULL | VND string |
| `metals_vnd` | `TEXT` | NOT NULL | |
| `markets_vnd` | `TEXT` | NOT NULL | |
| `liquidity_vnd` | `TEXT` | NOT NULL | |
| `real_estate_vnd` | `TEXT` | NOT NULL | |
| `created_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

**Upsert pattern** (SQLite 3.24+):
```sql
INSERT INTO net_worth_snapshots (snapshot_date, total_vnd, ...)
VALUES (date('now'), ?, ...)
ON CONFLICT(snapshot_date) DO UPDATE SET
  total_vnd = excluded.total_vnd, ...
```

**Indexes**: `(snapshot_date DESC)`

---

### `settings`

Single-row application settings.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `INTEGER` | PK DEFAULT 1 | Always one row |
| `currency` | `TEXT` | NOT NULL DEFAULT `'VND'` | |
| `notification_days_advance` | `TEXT` | NOT NULL DEFAULT `'[1,7]'` | JSON array |
| `timezone` | `TEXT` | NOT NULL DEFAULT `'Asia/Ho_Chi_Minh'` | |
| `updated_at` | `TEXT` | NOT NULL DEFAULT (datetime('now')) | |

---

## Entity Relationships

```
users                    (singleton — id always 1)

institutions ──< ledger_entries
institutions ──< savings_instruments
institutions ──< metals_holdings
institutions ──< asset_lots

asset_classes ──< ledger_entries
asset_classes ──< calendar_events
asset_classes ──< asset_lots

asset_lots      ──< asset_transactions   (one lot → many transactions; BUY creates, SELLs consume)

savings_instruments ──< calendar_events   (auto maturity event on create)
loans           ──< loan_payments         (cascade delete)
loans           ──< calendar_events       (loan_settled event on settle)
ledger_entries  ──< calendar_events       (optional link)

[net_worth_snapshots]    (standalone, upserted on every asset mutation)
[settings]               (singleton)
```

---

## State Transitions

### `asset_lots.status`
```
active         → partial_closed  (on partial SELL — remaining_volume decreases but > 0)
active         → closed          (on full SELL — remaining_volume reaches 0)
partial_closed → closed          (on subsequent SELL consuming all remaining)
```
Note: `asset_transactions` records are immutable — no state transitions apply.

### `loans.status` (computed)
```
principal > 0, no overdue payments → active
principal > 0, any payment overdue → overdue
remaining_balance ≤ 0             → settled
```

### `loan_payments.status`
```
scheduled → paid     (when paid_date set)
scheduled → overdue  (when due_date < TODAY and paid_date NULL)
```

### `savings_instruments.status`
```
active → matured    (when maturity_date ≤ TODAY)
active → withdrawn  (user action)
matured → withdrawn
```

---

## Key Validation Rules

- `loans.loan_type`: MUST be `lent` or `borrowed`
- `loan_payments.paid_amount`: MUST NOT exceed loan's remaining balance
- `savings_instruments.maturity_date`: MUST be after `start_date`
- `savings_instruments.instrument_type`: MUST be one of 4 allowed values
- `metals_holdings.purity`: MUST be in range (0, 100]
- `metals_holdings.weight_grams`: computed from `weight_display + weight_unit` at write time
- `net_worth_snapshots.snapshot_date`: UNIQUE — upsert enforced
- All monetary TEXT values: parseable as decimal number; 4 decimal places on write
- `asset_lots.remaining_volume`: MUST NOT go below `0`; enforced in FIFO service before DB write
- `asset_lots.asset_subtype`: MUST be one of `stock | crypto | mutual_fund | etf`
- `asset_transactions.transaction_type`: MUST be one of `buy | sell | dividend | split`
- SELL `volume`: MUST NOT exceed total `remaining_volume` across all active/partial_closed lots
  of the same `asset_name` (enforced in service before FIFO matching)
- `asset_transactions` rows are append-only; no UPDATE or DELETE permitted
