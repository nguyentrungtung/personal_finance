# Feature Specification: COURTIFY — Wealth Management Dashboard

**Feature Branch**: `001-courtify-wealth-dashboard`

**Created**: 2026-05-13

**Status**: Draft

**Input**: User description: "Build a personal finance management application called COURTIFY with the
tagline 'Elite Precision'. Desktop-first, dark-mode wealth management dashboard for high-net-worth
individuals tracking diverse asset portfolios in VND."

---

## Clarifications

### Session 2026-05-13

- Q: Is Loan & Debt Management a full first-class page/feature (US8) or a subset of Ledger? → A: Full independent page — US8 with dedicated data model (`loans` + `loan_payments` tables), separate sidebar nav item, and dedicated entry modal.
- Q: Which savings instrument types should be supported? → A: All 4 types shown in design: **Savings Account · Certificate of Deposit · Money Market · Treasury Bond**.
- Q: Should Settings include Profile (name, email, title, avatar) and Security (2FA, change password) in v1? → A: Yes — full Profile Settings + Security including 2FA TOTP and Change Password.
- Q: What authentication mechanism for v1? → A: Email + Password + JWT stored in httpOnly cookie; single-user account; 2FA via TOTP (e.g. Google Authenticator).
- Q: Should Loan & Debt tracking use full installment schedule or simple lump-sum? → A: Full installment schedule — each loan has multiple `loan_payments` records (amount, due date, paid date, status); remaining balance computed from payment history.

### Session 2026-05-14

- Q: Can Ledger entries be edited or deleted after creation? → A: Edit + Soft-Delete — fields are editable; delete sets `deleted_at` timestamp (row preserved); Dashboard and Net Worth recalculate automatically on change.
- Q: What happens when deleting an Institution that is referenced by existing records? → A: Soft-Delete / Archive — institution is hidden from all dropdowns; existing records retain the reference and display "(Archived)" label in history views.
- Q: Should the Dashboard support a Trillion-scale abbreviation (Nghìn tỷ) beyond M/B? → A: Yes — add `T` (Nghìn tỷ = 1,000,000,000,000 VND); display scale is M → B → T.
- Q: How should the Ledger page load its data at scale (1,000+ entries)? → A: Server-side pagination — 50 rows per page, Prev/Next controls; all filters and sort applied at DB query level.
- Q: How should the app handle JWT expiry during active form use? → A: Silent refresh — automatically renew JWT via a refresh token (httpOnly cookie) while the user is actively interacting; no interruption or data loss.
- Q: Should the Investment Ledger display each purchase separately (lot-based) or aggregate by asset? → A: Lot-based with Aggregated toggle — default view shows each acquisition lot as a separate row (matching UI mockup: 2 SJC Gold Bar rows with different dates); a toggle collapses all lots of the same asset into one row showing total quantity and weighted average cost.
- Q: When selling, which lot-matching method should be used and is Realized P&L tracked per lot? → A: FIFO + Per-lot Realized P&L — when a sell transaction is recorded, the system automatically reduces quantity from the oldest lot first; if the sell quantity exceeds one lot it spills to the next. Realized P&L is computed per consumed lot (sell price − lot buy price) × quantity sold from that lot. Aggregated view always shows the current weighted average cost across all active lots.
- Q: How is Current Market Price updated for stocks, metals, and other manually-priced assets? → A: Inline edit on Ledger — the user clicks the "Current Price" cell of any lot directly in the Ledger table, types the new price, and presses Enter; % Change recalculates immediately. One price update applies to the specific lot row (not broadcast to all lots of the same ticker automatically).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Dashboard Overview (Priority: P1)

A high-net-worth individual opens COURTIFY and immediately sees their complete financial picture:
total net worth in VND, growth since last period, a breakdown of four asset classes (Metals,
Markets, Liquidity, Real Estate) each with a mini sparkline chart, a donut chart of asset
allocation, and the five most recent ledger entries — all in a single view without scrolling on a
1280px+ screen.

**Why this priority**: The dashboard is the app's entry point and primary value proposition. It
must work before any other page has meaning.

**Independent Test**: Open the app with seeded portfolio data. The dashboard renders with correct
net worth total, four asset cards with accurate values and percentage growth, the donut chart
reflecting correct allocation percentages, and five recent transactions in the ledger table.

**Acceptance Scenarios**:

1. **Given** the user has portfolio data across all four asset classes, **When** they open the
   Dashboard, **Then** the net worth hero displays the correct VND total (e.g., 2,450,000,000 VND)
   with a growth badge (e.g., +12.5%) formatted using Vietnamese shorthand (M/B).
2. **Given** the Dashboard is open, **When** there are four asset classes with values,
   **Then** each asset card shows the class name, total value in VND shorthand, percentage change
   with appropriate color (green = positive), and a mini sparkline bar chart.
3. **Given** the Dashboard is open, **When** the user views the bottom panel, **Then** the donut
   chart correctly displays allocation percentages summing to 100%, and the ledger table shows the
   5 most recent entries with date/time, description, amount (±), and a status pill
   (Completed/Appraisal/Cleared).

---

### User Story 2 — Ledger Management (Priority: P2)

The user navigates to the Ledger page to view, filter, and sort the complete transaction history
across all asset classes. They can identify transactions by type (crypto purchase, real estate
appraisal, tax transfer, savings deposit, loan repayment), review counterparty or method, and see
the signed VND amount and status of each entry.

**Why this priority**: The ledger is the authoritative audit trail. High-net-worth users require
full visibility over every financial event.

**Independent Test**: Navigate to the Ledger page. Apply a filter by asset class and a sort by
date descending. Verify rows reflect the filter and sort, and that each row shows all six columns
with correct data.

**Acceptance Scenarios**:

1. **Given** the user is on the Ledger page, **When** the page loads, **Then** all transactions
   are listed in reverse-chronological order with columns: date, type icon, description,
   counterparty/method, amount (± VND), status pill.
2. **Given** the user selects a filter (e.g., asset class = "Metals"), **When** the filter is
   applied, **Then** only transactions belonging to the Metals class are displayed.
3. **Given** the user clicks a column header (e.g., "Amount"), **When** the sort is toggled,
   **Then** rows reorder by that column ascending/descending with a sort indicator visible.

---

### User Story 3 — Savings Instruments (Priority: P3)

The user navigates to the Savings page to track savings accounts and fixed-income instruments
across four types: Savings Account, Certificate of Deposit (CD), Money Market, and Treasury Bond.
They can view each instrument's institution, type, principal, annual interest rate, maturity date,
and accrued interest to date — helping them monitor liquidity and income from fixed income.

**Why this priority**: Fixed deposits and savings are a distinct asset subtype requiring dedicated
tracking beyond the general ledger.

**Independent Test**: Open the Savings page with seeded savings records. Verify each row displays
institution name, principal in VND, interest rate (%), maturity date, and calculated accrued
interest. Confirm a new entry can be added with all five fields.

**Acceptance Scenarios**:

1. **Given** the user is on the Savings page, **When** the page loads, **Then** all savings
   instruments are listed with columns: institution, instrument type, principal (VND), interest
   rate (% p.a.), maturity date, accrued interest (VND).
2. **Given** the user adds a new savings instrument, **When** they select an instrument type
   (Savings Account / CD / Money Market / Treasury Bond) and submit the form, **Then** the new
   record appears in the list and accrued interest is calculated from the principal, rate, and
   current date.

---

### User Story 4 — Physical Metals Holdings (Priority: P3)

The user navigates to the Metals section to track gold and silver holdings. Each entry records
weight (in chỉ, lượng, or gram), purity, purchase price per unit, and current market value —
enabling precise cost-basis and unrealised gain/loss calculation for precious metals.

**Why this priority**: Metals are a culturally significant asset class for Vietnamese high-net-worth
individuals and require weight-unit and purity tracking that is unique to this class.

**Independent Test**: Open the Metals ledger with seeded gold and silver entries. Verify each entry
shows weight, unit (chỉ/lượng/gram), purity, purchase price per unit (VND), and current value
(VND). Confirm the total metals value matches the figure shown on the Dashboard asset card.

**Acceptance Scenarios**:

1. **Given** the user is on the Metals page, **When** the page loads, **Then** each entry shows:
   asset (Gold/Silver), weight, unit (chỉ/lượng/gram), purity (e.g., 99.99%), purchase price per
   unit (VND), and current value (VND).
2. **Given** the user adds a new metals entry, **When** they select the weight unit, **Then** the
   system accepts chỉ, lượng, and gram and stores the value in a normalised unit internally.

---

### User Story 5 — Financial Calendar (Priority: P4)

The user opens the Calendar page to see a timeline of upcoming financial events: investment
maturity dates, debt due dates, and savings goals. Visual indicators highlight obligations due
within the next 7 and 30 days, so the user can plan cash-flow proactively.

**Why this priority**: High-net-worth individuals manage multiple time-bound obligations; missing a
maturity or debt deadline has real financial cost.

**Independent Test**: Seed a maturity event 5 days out and a debt due date 25 days out. Open the
Calendar. Verify both events appear, the near-term event has a warning indicator, and clicking an
event shows its detail (name, amount, date, linked asset).

**Acceptance Scenarios**:

1. **Given** the user is on the Calendar page, **When** the page loads, **Then** all financial
   events are displayed on a timeline sorted by date.
2. **Given** an event is due within 7 days, **When** the calendar renders, **Then** the event is
   highlighted with an amber/warning indicator.
3. **Given** the user clicks an event, **When** the detail panel opens, **Then** it shows event
   name, amount (VND), due date, event type, and linked asset class.

---

### User Story 6 — Analytics (Priority: P4)

The user opens the Analytics page to review net worth trend over time (line chart), compare
performance across asset classes (grouped bar chart), and optionally toggle a predictive projection
for the next period.

**Why this priority**: Trend visibility and cross-class comparison are the analytical backbone for
investment decisions.

**Independent Test**: Seed 12 months of net worth snapshots and per-class values. Open Analytics.
Verify the line chart shows 12 data points, the grouped bar chart shows 4 bars per period, and the
projection toggle renders a dashed forecast line.

**Acceptance Scenarios**:

1. **Given** the user is on the Analytics page, **When** the page loads, **Then** a line chart
   displays net worth over time with selectable time ranges (3M / 6M / 1Y / All).
2. **Given** the user views the grouped bar chart, **When** a period is selected, **Then** the
   chart displays bars for each asset class with values labelled in VND shorthand.
3. **Given** the user toggles the predictive projection, **When** enabled, **Then** a dashed line
   extending 3 months forward appears, based on the average growth rate of the trailing period.

---

### User Story 7 — Settings & Institutions (Priority: P5)

The user opens Settings to: (a) manage their profile (Full Name, Email, Professional Title,
Avatar); (b) configure security (Change Password, enable/disable 2FA TOTP); (c) manage the
institution list (banks, brokers) that populates dropdowns app-wide; (d) configure notification
preferences; and (e) set currency and timezone localization.

**Why this priority**: Settings cover both shared infrastructure (institutions) and personal
account management. Institution integrity ensures consistent counterparty data app-wide; profile
and security settings establish user identity and access control.

**Independent Test**: (1) Add institution "VP Bank – Investment" → open Ledger form → confirm it
appears in dropdown. (2) Update Full Name → verify updated name displays in sidebar. (3) Enable
2FA → scan TOTP QR code → verify login requires TOTP code on next session.

**Acceptance Scenarios**:

1. **Given** the user adds an institution in Settings, **When** they open any form with an
   institution/counterparty dropdown, **Then** the new institution appears as an option immediately.
2. **Given** the user sets a notification preference (e.g., 7-day advance reminder), **When** an
   event enters the 7-day window, **Then** a notification indicator appears in the app header.
3. **Given** the user updates their Full Name and Professional Title, **When** they save, **Then**
   the updated name and title display in the sidebar user profile area.
4. **Given** the user enables 2FA, **When** they complete TOTP setup (scan QR, verify code),
   **Then** subsequent logins require a valid TOTP code after password entry.
5. **Given** the user changes their password, **When** the new password is confirmed and saved,
   **Then** the old password no longer authenticates and the new password does.

---

### User Story 8 — Loan & Debt Management (Priority: P3)

The user navigates to the dedicated Loan & Debt Management page to track personal lending and
borrowing. The page shows summary cards (Total Lent, Total Borrowed, Net Balance) and a filterable
table of all loans. For each loan the user can record multiple installment payments, track the
remaining balance, and see whether the loan is Active, Overdue, or Settled.

**Why this priority**: Loans and debts are a first-class financial obligation for HNW individuals.
Tracking who owes what — and whether payments are on schedule — is distinct from asset ledger
entries and requires dedicated management with repayment scheduling.

**Independent Test**: Create a "Lent" loan of 15,000,000 VND to "Le Nam" due 2027-01-01 with
3 monthly installments of 5,000,000 VND. Record the first installment as paid. Verify remaining
balance shows 10,000,000 VND, status shows Active, and the next payment due date reflects the
second installment.

**Acceptance Scenarios**:

1. **Given** the user is on the Loan & Debt Management page, **When** the page loads, **Then**
   summary cards display Total Lent (VND), Total Borrowed (VND), and Net Balance (VND), and the
   table lists all loans with columns: Recipient/Lender, Principal, Remaining Balance, Date Issued,
   Due Date, Status (Active/Overdue/Settled), Actions.
2. **Given** the user records a new loan via the modal, **When** they choose "Lent (Money Out)"
   and submit, **Then** the loan appears in the table with status Active and the Total Lent
   summary updates immediately.
3. **Given** a loan has scheduled installments, **When** the user records a payment against it,
   **Then** the remaining balance decreases by the payment amount and the next payment due date
   advances to the following installment.
4. **Given** a loan's due date has passed and remaining balance > 0, **When** the page loads,
   **Then** the loan row displays status Overdue with an amber indicator.
5. **Given** a loan's remaining balance reaches 0, **When** the last payment is recorded, **Then**
   the loan status automatically transitions to Settled with a gray/muted indicator.

---

### User Story 9 — Authentication (Priority: P0 — Prerequisite)

The user authenticates into COURTIFY with their email and password before accessing any page.
If 2FA is enabled on their account, they also enter a TOTP code from their authenticator app.
Unauthenticated requests to any page redirect to the Login screen.

**Why this priority**: P0 — Authentication must work before any other page is accessible. Profile
and Security settings (US7) depend on an authenticated user context.

**Independent Test**: (1) Load the app unauthenticated → verify redirect to Login screen.
(2) Enter valid email + password → verify redirect to Dashboard. (3) Enable 2FA in Settings →
log out → log in with valid password → verify TOTP prompt appears → enter valid code → verify
Dashboard loads.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user accesses any route, **When** the request is made, **Then**
   they are redirected to `/login`.
2. **Given** the user submits valid email and password, **When** authentication succeeds, **Then**
   a JWT is issued (httpOnly cookie) and the user is redirected to the Dashboard.
3. **Given** the user submits invalid credentials, **When** authentication fails, **Then** an
   error message is displayed and no session is created.
4. **Given** 2FA is enabled on the account, **When** the user passes password authentication,
   **Then** a TOTP challenge screen is shown; only a valid TOTP code proceeds to Dashboard.
5. **Given** the user clicks "Log Out", **When** confirmed, **Then** the JWT cookie is invalidated
   and the user is redirected to `/login`.

---

### Edge Cases

- What happens when the portfolio has no data? → Each page renders an empty-state illustration
  with a prompt to add the first entry; net worth displays as 0 VND.
- What happens when an asset class has no transactions? → Its dashboard card shows 0 VND and 0%
  growth; the allocation donut hides the empty slice.
- How does the system handle a VND monetary input with invalid characters (e.g., letters)? →
  Input rejects non-numeric characters on keypress; formats the valid value on blur.
- What happens when a savings instrument reaches maturity? → Its maturity date cell turns amber
  and a calendar event is automatically generated.
- How does the app behave on a viewport narrower than 1280px? → A banner warns the user that the
  app is optimised for desktop (≥ 1280px); layout degrades gracefully but is not supported.
- What if a metals weight unit conversion leads to a fractional chỉ value? → The system stores
  the canonical gram value internally; display rounds to 4 decimal places.
- What happens when a loan payment amount exceeds the remaining balance? → The system rejects the
  payment with a validation error; overpayment is not permitted.
- What happens when a user attempts to delete a loan that has recorded payments? → The system
  warns the user and requires explicit confirmation; all associated payment records are deleted.
- What happens when a user tries to delete an Institution referenced by existing records? →
  The institution is soft-deleted (archived): hidden from all dropdowns for new entries,
  existing records retain the reference, and the institution name shows "(Archived)" in
  history views. Hard deletion is blocked while references exist.
- What happens when a Ledger entry is edited or deleted? → Edit updates all affected asset-class
  totals and net worth immediately. Delete performs a soft-delete (`deleted_at` set); the entry
  is hidden from all views and excluded from calculations but retained in DB for audit.
- What if a user loses their TOTP device and cannot log in? → A recovery code (generated at 2FA
  setup) can be used to bypass TOTP and disable 2FA; the user must then reconfigure 2FA.
- What happens on a failed login attempt (wrong password)? → After 5 consecutive failures the
  account is locked for 15 minutes; an error message informs the user.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display total net worth in VND on the Dashboard hero, formatted with
  Vietnamese shorthand (M = triệu = 1,000,000; B = tỷ = 1,000,000,000; T = nghìn tỷ =
  1,000,000,000,000), alongside a growth badge showing percentage change from the previous
  period. Negative net worth MUST display in red with a minus prefix (e.g., -1.5B VND).
- **FR-002**: The Dashboard MUST display four asset-class summary cards (Metals, Markets,
  Liquidity, Real Estate), each showing total VND value, percentage change, and a mini sparkline
  bar chart.
- **FR-003**: The Dashboard MUST display an asset allocation donut chart showing the percentage
  share of each asset class, with a legend.
- **FR-004**: The Dashboard MUST display the five most recent ledger entries with status pills
  colour-coded: green = Completed, amber = Appraisal/Pending, gray = Cleared.
- **FR-005**: The Ledger page MUST list all transactions with columns: date/time, type icon,
  description, counterparty/method, signed VND amount, status pill.
- **FR-006**: The Ledger MUST support filtering by asset class, entry type, date range, and status.
- **FR-007**: The Ledger MUST support sorting by any column header with toggle (ascending/
  descending). Sorting MUST be applied server-side at the DB query level.
- **FR-043**: The Ledger MUST implement server-side pagination at 50 rows per page with
  Prev/Next controls. All filters (FR-006) and sort (FR-007) are applied at the DB level
  before pagination; the total entry count and current page MUST be displayed.
- **FR-044**: A Ledger entry MAY be edited (any field) after creation; edits MUST trigger
  recalculation of all affected asset-class totals and net worth on the Dashboard.
- **FR-045**: A Ledger entry MAY be soft-deleted; deletion sets a `deleted_at` timestamp
  (DB row is preserved for audit); soft-deleted entries are excluded from all calculations
  and views. The action requires explicit user confirmation.
- **FR-008**: The Savings page MUST list all savings instruments with fields: institution,
  instrument type (Savings Account / Certificate of Deposit / Money Market / Treasury Bond),
  principal (VND), annual interest rate (%), maturity date, accrued interest (VND, auto-calculated).
- **FR-009**: The Metals page MUST support entry of precious metals with fields: asset type
  (Gold/Silver), weight, weight unit (chỉ/lượng/gram), purity, purchase price per unit (VND),
  current value (VND). **Note on data model**: Physical metals holdings are stored in the
  dedicated `metals_holdings` table (weight, purity, price-per-gram). The Investment Ledger's
  "Gold/Silver" tab uses the `asset_lots` table for lot-based trading positions (e.g., SJC
  certificates traded as units). The Dashboard Metals card aggregates from **both** tables:
  total metals value = sum of `metals_holdings` current values + sum of active `asset_lots`
  where `asset_class = 'metals'`.
- **FR-010**: All weight units (chỉ, lượng, gram) MUST be stored in a canonical unit (gram) and
  converted for display.
- **FR-011**: The Calendar page MUST display financial events (maturity dates, debt due dates,
  savings goals) on a timeline sorted by date.
- **FR-012**: Events due within 7 days MUST be visually highlighted with an amber indicator.
- **FR-013**: The Analytics page MUST display a net worth line chart with selectable time ranges
  (3M / 6M / 1Y / All).
- **FR-014**: The Analytics page MUST display a grouped bar chart comparing asset class performance
  per period.
- **FR-015**: The Analytics page MUST include a predictive projection toggle that extends the net
  worth trend line 3 months forward using the trailing 3-month average monthly growth rate
  computed from `net_worth_snapshots`.
- **FR-016**: Settings MUST allow users to create, edit, and archive institutions that populate
  counterparty/institution dropdowns across the entire app. Archiving an institution hides it
  from all dropdowns (preventing new references) but retains existing records; archived
  institutions display an "(Archived)" label in history views. Hard deletion is not permitted
  if any records reference the institution.
- **FR-017**: Settings MUST allow users to set notification preferences for upcoming calendar
  events (configurable advance notice: 1 / 3 / 7 / 30 days).
- **FR-018**: All monetary input fields MUST accept raw numeric input and auto-format to
  comma-separated VND on blur (e.g., 1500000 → 1,500,000 VND).
- **FR-019**: All monetary arithmetic MUST use JavaScript `Number` (IEEE 754 float64) in the
  service layer only; intermediate results MUST be rounded to 4 decimal places before any
  database write, and stored as `TEXT` decimal strings (e.g., `"2450000.0000"`). Monetary
  values MUST NOT be stored as `REAL` or `INTEGER` in SQLite (Constitution VII).
- **FR-020**: The active navigation item MUST be indicated by a green left border and green text;
  all navigation items MUST render with the configured icons.
- **FR-021**: The application MUST render correctly at viewport widths ≥ 1280px; narrower
  viewports MUST display a desktop-optimised warning banner.
- **FR-022**: The sidebar MUST include an "Upgrade to Pro" call-to-action at the bottom.
- **FR-023**: The system MUST require email + password authentication before granting access to
  any page; unauthenticated requests MUST redirect to `/login`.
- **FR-024**: The system MUST issue a short-lived JWT (access token) on successful login stored
  as an httpOnly cookie; a separate long-lived refresh token (httpOnly cookie) MUST be issued
  to silently renew the access token while the user is actively interacting with the app.
  All API endpoints MUST validate the JWT. On password change, all refresh tokens for the
  account MUST be invalidated (via a `token_version` field on the User record).
- **FR-025**: The system MUST support 2FA via TOTP (RFC 6238); when enabled, a valid TOTP code
  MUST be required after password verification on each login.
- **FR-026**: The system MUST lock an account for 15 minutes after 5 consecutive failed login
  attempts and display a clear message to the user.
- **FR-027**: Settings MUST allow the authenticated user to update their Full Name, Email,
  Professional Title, and Avatar (image upload, stored as a local file).
- **FR-028**: Settings MUST allow the authenticated user to change their password (requires
  current password confirmation).
- **FR-029**: The Loan & Debt Management page MUST display summary cards: Total Lent (VND),
  Total Borrowed (VND), Net Balance (VND), and a filterable/sortable loan table.
- **FR-030**: Each loan MUST record: type (Lent / Borrowed), counterparty name, principal (VND),
  date issued, expected due date, interest/repayment terms (free-text), and description.
- **FR-031**: Each loan MUST support multiple installment payment records; each payment carries:
  scheduled amount (VND), due date, paid amount (VND), paid date, and status
  (Scheduled / Paid / Overdue).
- **FR-032**: Loan remaining balance MUST be computed as `principal − sum(paid payments)` and
  displayed on the loan table.
- **FR-033**: Loan status MUST be computed automatically: Active (balance > 0, not overdue) /
  Overdue (balance > 0 and due date passed) / Settled (balance = 0).
- **FR-034**: The Loan & Debt Management page MUST support filtering by type (All / Lent /
  Borrowed / Settled) and sorting by counterparty, amount, due date, and status.
- **FR-035**: A loan reaching Settled status MUST automatically generate a Calendar event of type
  `loan_settled` for the settlement date.
- **FR-036**: The Investment Ledger (tabs: Gold/Silver, Stocks/Crypto, Savings/Funds, Real Estate)
  MUST display assets in **Lot view** by default: each acquisition lot is a separate row showing
  asset name, purchase date, buy price per unit (VND), current price per unit (VND), volume +
  unit, and % change since purchase.
- **FR-037**: The Investment Ledger MUST provide a **Aggregated view toggle** that collapses all
  active lots of the same asset into a single row, displaying: total remaining volume, weighted
  average cost (VND), current price per unit (VND), total current value (VND), and blended %
  change. The toggle persists only for the current session.
- **FR-038**: **Lot creation (BUY)**: Adding a new investment entry creates one `AssetLot` record
  and one `AssetTransaction` record (type=BUY). The lot starts with `status=ACTIVE` and
  `remaining_volume = original_volume`.
- **FR-039**: **Lot reduction (SELL — FIFO)**: When recording a sell, the user specifies the
  asset and total volume to sell. The system applies FIFO lot-matching automatically: it reduces
  `remaining_volume` on the oldest ACTIVE lot first; if the sell volume exceeds that lot's
  remaining quantity, it spills to the next oldest lot. Each consumed lot segment generates one
  `AssetTransaction` record (type=SELL) with `realized_pnl` computed as
  `(sell_price − lot_buy_price) × volume_sold_from_lot`. A lot whose `remaining_volume` reaches 0
  transitions to `status=CLOSED`; a partially consumed lot transitions to `status=PARTIAL_CLOSED`.
- **FR-040**: **Current price inline edit**: In Lot view, the user MAY click the "Current Price"
  cell of any lot row to edit the value inline; pressing Enter saves the new price and immediately
  recalculates the % change for that row. Updating the price of one lot does NOT automatically
  propagate to other lots of the same asset.
- **FR-041**: **Realized P&L history**: All SELL `AssetTransaction` records are retained
  permanently and accessible from a "Trade History" tab or expandable panel within the Investment
  Ledger, showing date, volume sold, sell price, lot buy price, and realized P&L per sell event.
- **FR-042**: The Analytics page MUST include a **Realized P&L summary** showing total profit/loss
  from closed lots, filterable by asset class and selectable time period.

### Key Entities

- **Portfolio**: Aggregate of all asset holdings for a user; source of net worth and allocation
  calculations.
- **AssetClass**: Enumerated category — Metals | Markets | Liquidity | Real Estate.
- **LedgerEntry**: A financial transaction event; linked to an AssetClass; carries type, date,
  description, counterparty, signed VND amount, and status.
- **AssetLot**: A single acquisition lot for any investable asset (stock ticker, metal product,
  mutual fund). Carries: `asset_class`, `asset_name` (ticker/product name), `broker_institution`,
  `purchase_date`, `original_volume`, `remaining_volume`, `buy_price_per_unit` (VND),
  `current_price_per_unit` (VND, manually updated via inline edit), `unit` (shares / gram /
  certificate), `status` (ACTIVE | PARTIAL_CLOSED | CLOSED). For Metals: also stores `purity`
  and `weight_unit_display` (chỉ/lượng/gram); canonical storage is always gram.
- **AssetTransaction**: An immutable event log record generated for every BUY or SELL action.
  Carries: `lot_id` (FK → AssetLot), `transaction_type` (BUY | SELL | DIVIDEND | SPLIT),
  `timestamp`, `volume` (positive for BUY, negative for SELL), `price_per_unit` (VND),
  `fee` (VND), `net_amount` (signed VND cash flow), `realized_pnl` (VND, non-null on SELL,
  computed as `(sell_price − lot_buy_price) × volume_sold_from_lot`). FIFO lot-matching: a
  single sell order may generate multiple AssetTransaction rows (one per consumed lot).
- **SavingsInstrument**: A fixed-income holding; linked to an institution; carries principal,
  rate, maturity date.
- **CalendarEvent**: A time-bound financial obligation or milestone; linked to an optional
  LedgerEntry or SavingsInstrument.
- **Institution**: A named financial institution (bank or broker) used as counterparty across
  Ledger, Savings, and Metals. Carries an `archived_at` timestamp; archived institutions are
  excluded from dropdowns but retained for historical reference.
- **NetWorthSnapshot**: A point-in-time record of total net worth; used for trend and analytics
  charts.
- **User**: The single authenticated account; carries email, hashed password, Full Name,
  Professional Title, avatar path, 2FA secret, `totp_recovery_codes` (stored as JSON array of
  bcrypt-hashed strings, e.g. `'["$2b$10$...", ...]'`; generated once at 2FA setup; single-use
  each), and `token_version` (integer, starts at 0, incremented on every password change to
  immediately invalidate all active refresh tokens for the account).
- **Loan**: A personal lending or borrowing record; carries type (lent/borrowed), counterparty
  name, principal, dates, terms, and computed status (Active/Overdue/Settled).
- **LoanPayment**: An installment record linked to a Loan; carries scheduled amount, due date,
  paid amount, paid date, and payment status (Scheduled/Paid/Overdue).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can view their complete financial overview — net worth, four asset cards,
  allocation chart, and recent ledger — in under 2 seconds from app open on a standard desktop
  connection (aligned with Constitution IV: initial page load ≤ 2 s).
- **SC-002**: A user can add a new ledger entry (any type) in under 60 seconds, including
  institution selection from the dropdown.
- **SC-003**: All monetary values throughout the app display in correctly formatted VND with
  Vietnamese shorthand (M/B/T), with zero formatting errors across all pages. Negative values
  display in red with a minus prefix.
- **SC-004**: The allocation donut chart always sums to exactly 100% regardless of the number of
  asset classes with non-zero balances.
- **SC-005**: A user can locate any past transaction using Ledger filters, sort, and pagination
  in under 30 seconds for a portfolio with up to 1,000 entries. Each paginated page MUST load
  in under 1 second (server-side query + render).
- **SC-006**: Calendar events due within 7 days are visually distinguishable from later events
  100% of the time (verified by automated visual regression test).
- **SC-007**: The Analytics projection toggle renders without page reload in under 500 ms after
  activation.
- **SC-008**: Institution additions in Settings are immediately available in all entry form
  dropdowns without page refresh.
- **SC-009**: A user can record a new loan and its first installment payment in under 90 seconds.
- **SC-010**: Login (email + password, no 2FA) completes in under 2 seconds including JWT issuance.
- **SC-011**: 2FA setup (enable, scan QR, verify code) completes in under 3 minutes for a first-time user.

---

## Assumptions

- Users are single-tenant (one user per installation/session); multi-user/team accounts are out of
  scope for v1.
- Market price data for Securities (Markets asset class) and Metals is updated manually by the
  user via **inline edit** on the Current Price cell of each lot row in the Investment Ledger;
  live price feed / API integration is out of scope for v1. Price updates are per-lot (not
  broadcast to all lots of the same ticker).
- Crypto exchange API integration (mentioned as an entry type) means the user manually records
  exchange-sourced transactions; automated API sync is out of scope for v1.
- The app is a web application running in a desktop browser; native desktop packaging (Electron,
  Tauri) is out of scope for v1.
- Authentication uses email + password + JWT (httpOnly cookie) with optional 2FA via TOTP. JWT
  lifecycle: short-lived access token + long-lived refresh token (both httpOnly cookies); silent
  renewal via `POST /auth/refresh` while user is active.
- Data persistence uses SQLite 3 via `better-sqlite3` (WAL mode), stored in Docker named volume
  `sqlitedata` at `/app/data/courtify.db`; no DB container required. Cloud sync is out of scope for v1.
- The "Upgrade to Pro" CTA in the sidebar is a static UI element; Pro tier features and payment
  flow are out of scope for v1.
- Vietnamese locale (Asia/Ho_Chi_Minh, GMT+07:00) is the only supported locale for v1;
  internationalisation is not required.
- The predictive projection algorithm uses a simple trailing-average growth rate; ML-based
  forecasting is out of scope.
