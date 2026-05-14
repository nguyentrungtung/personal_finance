---
description: "Task list for COURTIFY — Wealth Management Dashboard"
---

# Tasks: COURTIFY — Wealth Management Dashboard

**Input**: Design documents from `/specs/001-courtify-wealth-dashboard/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tech Stack**: TypeScript 5.4+ · Express 4 · React 18 · SQLite 3 (better-sqlite3) · Knex migrations · shadcn/ui · Recharts 2 · React Hook Form + Zod · pnpm monorepo · Docker Compose (2 services)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Each service/route task is paired with a unit-test or contract-test task (Constitution II: TDD Red-Green-Refactor mandatory; ≥80% coverage; contract test per endpoint).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US9)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the pnpm monorepo, Docker environment, and tooling so all subsequent work has a stable foundation.

- [ ] T001 Initialize pnpm monorepo root with `package.json`, `pnpm-workspace.yaml`, and `.gitignore` at `courtify/`
- [ ] T002 Create `docker-compose.yml` with `frontend` (port 3000) and `backend` (port 5000) services, named volumes `sqlitedata` and `uploads`, at `courtify/docker-compose.yml`
- [ ] T003 Create `.env.example` with `DB_PATH`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `UPLOAD_PATH`, `VITE_API_URL`, `INIT_EMAIL`, `INIT_PASSWORD` at `courtify/.env.example`
- [ ] T004 [P] Scaffold `courtify/backend/` Node/Express project: `package.json` with `express`, `better-sqlite3`, `knex`, `bcryptjs`, `jsonwebtoken`, `otplib`, `qrcode`, `zod`, `cookie-parser`, `cors`, `multer`; `tsconfig.json`; `vitest.config.ts`
- [ ] T005 [P] Scaffold `courtify/frontend/` React/Vite project: `package.json` with `react`, `react-router-dom`, `tailwindcss`, `shadcn/ui`, `recharts`, `react-hook-form`, `zod`, `@hookform/resolvers`; `vite.config.ts`; `tsconfig.json`; `vitest.config.ts`; `playwright.config.ts`
- [ ] T006 [P] Scaffold `courtify/packages/types/` shared package: `package.json`, `tsconfig.json`, `src/index.ts`
- [ ] T007 [P] Configure ESLint + Prettier at monorepo root (`courtify/.eslintrc.js`, `courtify/.prettierrc`) with TypeScript strict rules; add `lint` and `format` scripts to root `package.json`
- [ ] T008 Configure Tailwind CSS and shadcn/ui in `courtify/frontend/`: `tailwind.config.ts`, `courtify/frontend/src/styles/globals.css` with dark-mode design tokens (color palette, spacing, typography)
- [ ] T008b [P] Create GitHub Actions CI workflow at `courtify/.github/workflows/ci.yml`: jobs — (1) lint: ESLint + tsc --noEmit; (2) test: vitest run with coverage threshold ≥80% on business-logic modules; (3) e2e: Playwright in headless mode; (4) performance: Supertest benchmark for `GET /api/v1/dashboard` p95 ≤200ms with seeded data; all jobs block merge on failure (Constitution IV quality gate)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure — DB client, all migrations, shared Zod schemas, Express middleware, shared frontend utilities and layout shell — that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T009 Implement `better-sqlite3` singleton with WAL mode + foreign keys in `courtify/backend/src/db/client.ts` (pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`)
- [ ] T010 Create Knex migration config `courtify/backend/knexfile.ts` pointing to `DB_PATH` env var; add `migrate` and `migrate:rollback` npm scripts
- [ ] T011 Write Knex migration `001_users.ts` creating `users` table (id, email UNIQUE, password_hash, full_name, professional_title, avatar_path, totp_secret, totp_enabled BOOLEAN DEFAULT 0, totp_recovery_codes TEXT DEFAULT '[]' — JSON array of bcrypt-hashed strings, failed_login_attempts INTEGER DEFAULT 0, locked_until, **token_version INTEGER NOT NULL DEFAULT 0**, created_at, updated_at) in `courtify/backend/src/db/migrations/`
- [ ] T012 [P] Write Knex migration `002_institutions.ts` creating `institutions` table (id, name UNIQUE, type, archived_at, created_at, updated_at) in `courtify/backend/src/db/migrations/`
- [ ] T013 [P] Write Knex migration `003_asset_classes.ts` creating `asset_classes` table + seed rows (metals/markets/liquidity/real_estate) in `courtify/backend/src/db/migrations/`
- [ ] T014 [P] Write Knex migration `004_ledger_entries.ts` creating `ledger_entries` table with all columns + indexes `(asset_class_id)`, `(status)`, `(transaction_date DESC)`, `(institution_id)` + soft-delete `deleted_at` column in `courtify/backend/src/db/migrations/`
- [ ] T015 [P] Write Knex migration `005_savings_instruments.ts` creating `savings_instruments` table with indexes `(institution_id)`, `(maturity_date)`, `(status)` in `courtify/backend/src/db/migrations/`
- [ ] T016 [P] Write Knex migration `006_asset_lots.ts` creating `asset_lots` table with indexes `(asset_class_id)`, `(asset_name)`, `(status)`, `(purchase_date ASC)` in `courtify/backend/src/db/migrations/`
- [ ] T017 [P] Write Knex migration `007_asset_transactions.ts` creating `asset_transactions` table (immutable, no soft-delete) with indexes `(lot_id)`, `(transaction_type)`, `(transaction_date DESC)` in `courtify/backend/src/db/migrations/`
- [ ] T018 [P] Write Knex migration `008_metals_holdings.ts` creating `metals_holdings` table with indexes `(metal_type)`, `(purchase_date)` in `courtify/backend/src/db/migrations/`
- [ ] T019 [P] Write Knex migration `009_loans.ts` creating `loans` table with indexes `(loan_type)`, `(status)`, `(expected_due_date)` in `courtify/backend/src/db/migrations/`
- [ ] T020 [P] Write Knex migration `010_loan_payments.ts` creating `loan_payments` table (CASCADE DELETE on loan_id FK) with indexes `(loan_id)`, `(due_date)`, `(status)` in `courtify/backend/src/db/migrations/`
- [ ] T021 [P] Write Knex migration `011_calendar_events.ts` creating `calendar_events` table with indexes `(due_date ASC)`, `(event_type)`, `(is_dismissed)` in `courtify/backend/src/db/migrations/`
- [ ] T022 [P] Write Knex migration `012_net_worth_snapshots.ts` creating `net_worth_snapshots` table with UNIQUE `(snapshot_date)` and index `(snapshot_date DESC)` in `courtify/backend/src/db/migrations/`
- [ ] T023 [P] Write Knex migration `013_settings.ts` creating single-row `settings` table (id=1 DEFAULT, currency, notification_days_advance JSON, timezone) with defaults in `courtify/backend/src/db/migrations/`
- [ ] T024 Create seed script `courtify/backend/src/db/seed.ts` seeding: 1 user (INIT_EMAIL/INIT_PASSWORD bcrypt-hashed), 5 institutions, 4 asset classes, 20 ledger entries, 3 savings instruments, 5 metals holdings, 3 loans with installments, 12 months of net_worth_snapshots; add `seed` npm script
- [ ] T024b [P] Extract calendar auto-event helpers into `courtify/backend/src/services/calendarEventHelpers.ts` (no DB client dependency in module signature — receives a `db` parameter): `createMaturityEvent(db, savingsId, maturityDate, principalAmount)` and `createLoanSettledEvent(db, loanId, settlementDate)` that INSERT into `calendar_events` table; **this module MUST be available before Phase 6 (loanService) and Phase 7 (savingsService) which call these helpers** — resolves circular dependency where calendarService (Phase 10) would otherwise be needed earlier
- [ ] T025 Define all Zod schemas (single source of truth per Constitution V) in `courtify/backend/src/schemas/index.ts`: monetary TEXT regex validator, enum values for all TEXT enum columns, request/response schemas for every route endpoint
- [ ] T026 [P] Define shared TypeScript types and Zod schemas in `courtify/packages/types/src/`: `asset.ts` (AssetClass, AssetLot, AssetTransaction schemas), `auth.ts` (Login, JWT payload), `ledger.ts` (LedgerEntry), `savings.ts` (SavingsInstrument), `loan.ts` (Loan, LoanPayment), `analytics.ts` (NetWorthSnapshot, PnL), `index.ts` re-exporting all
- [ ] T027 Define custom error classes `BusinessRuleError`, `NotFoundError`, `AuthError` in `courtify/backend/src/errors.ts`; implement global Express error handler in `courtify/backend/src/middleware/errorHandler.ts` mapping ZodError→400, BusinessRuleError→422, NotFoundError→404, AuthError→401, unhandled→500 (no stack traces in production)
- [ ] T028 [P] Implement `asyncHandler` wrapper for async Express route handlers in `courtify/backend/src/middleware/asyncHandler.ts`
- [ ] T029 [P] Implement `validateBody(schema)` Zod middleware factory in `courtify/backend/src/middleware/validateBody.ts`
- [ ] T030 Implement Express app bootstrap in `courtify/backend/src/index.ts`: mount all routes under `/api/v1/`, apply CORS (localhost:3000), cookie-parser, static file serving for `/app/uploads/`, auto-create initial user from `INIT_EMAIL`/`INIT_PASSWORD` env vars on startup if no user exists; run `knex migrate:latest` on startup
- [ ] T031 [P] Implement `formatVND(value, opts)` and `abbreviateVND()` utilities in `courtify/frontend/src/lib/vnd.ts`: `≥1T→{n}T VND`, `≥1B→{n}B VND`, `≥1M→{n}M VND`, else full comma format; use `Intl.NumberFormat('vi-VN')` for raw input blur formatting; negative values display with minus prefix
- [ ] T032 [P] Implement typed fetch API client in `courtify/frontend/src/lib/api.ts`: base URL from `VITE_API_URL`, `credentials: 'include'`, typed request/response methods using packages/types schemas, handle 401 → trigger silent refresh via `POST /api/v1/auth/refresh`
- [ ] T033 [P] Implement `VNDInput` component (rejects non-numeric on keypress, auto-formats on blur with `formatVND`) in `courtify/frontend/src/components/shared/VNDInput.tsx`
- [ ] T034 [P] Implement `StatusPill` component with color coding (green=Completed, amber=Appraisal/Pending, gray=Cleared) in `courtify/frontend/src/components/shared/StatusPill.tsx`
- [ ] T035 [P] Implement `EmptyState` component with illustration slot and call-to-action text in `courtify/frontend/src/components/shared/EmptyState.tsx`
- [ ] T036 Implement `Sidebar` component with navigation links (Dashboard, Ledger, Investment Ledger, Savings, Metals, Loans, Calendar, Analytics, Settings), active item green left-border + green text per FR-020, user profile area (full_name + professional_title from auth context), "Upgrade to Pro" CTA at bottom per FR-022 in `courtify/frontend/src/components/layout/Sidebar.tsx`
- [ ] T037 [P] Implement `Header` component with notification indicator badge (lit when calendar events fall within notification_days_advance window) in `courtify/frontend/src/components/layout/Header.tsx`
- [ ] T038 Set up React Router 6 in `courtify/frontend/src/App.tsx`: protected route wrapper redirecting unauthenticated users to `/login`, layout shell (Sidebar + Header), route paths for all pages; add viewport width warning banner for `< 1280px` per FR-021

**Checkpoint**: Foundation ready — migrations, middleware, shared utilities, and layout shell complete. User story implementation can now begin.

---

## Phase 3: User Story 9 — Authentication (Priority: P0 — Prerequisite)

**Goal**: Email + password + JWT (httpOnly cookie) login with optional 2FA TOTP challenge, account lockout after 5 consecutive failures (15 min), silent JWT refresh while user is active, and redirect to `/login` for all unauthenticated access.

**Independent Test**: (1) Load app unauthenticated → redirect to /login. (2) POST valid credentials → JWT cookie issued, redirect to Dashboard. (3) POST invalid credentials 5× → 15-min lockout message. (4) Enable 2FA → logout → login → TOTP challenge → valid code → Dashboard.

- [ ] T039 Implement `authService.ts` in `courtify/backend/src/services/authService.ts`: `login(email, password)` with bcryptjs verify + lockout (≥5 failures → `locked_until=NOW+15min`, reset on success), `issueTokens(userId)` generating short-lived access JWT + long-lived refresh JWT (both httpOnly cookies), `refreshTokens(refreshToken)` validating `token_version`, `logout()` clearing cookies, `setupTotp(userId)` generating base32 secret + QR code URI via `otplib`+`qrcode`, `verifyTotpSetup(userId, code)` enabling 2FA + generating 8 recovery codes (bcrypt-hashed), `verifyTotp(userId, code)`, `useRecoveryCode(userId, code)` clearing 2FA, `changePassword(userId, currentPw, newPw)` re-hashing + incrementing `token_version`
- [ ] T040 Implement JWT cookie verification middleware in `courtify/backend/src/middleware/auth.ts`: reads access token cookie, verifies JWT signature, checks `token_version` matches user record, sets `req.userId`; returns AuthError 401 on any failure
- [ ] T041 Implement auth routes in `courtify/backend/src/routes/auth.ts`: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me` (protected), `POST /api/v1/auth/2fa/setup` (protected), `POST /api/v1/auth/2fa/verify-setup` (protected), `POST /api/v1/auth/2fa/verify`, `DELETE /api/v1/auth/2fa` (protected), `POST /api/v1/auth/2fa/recovery`, `PUT /api/v1/auth/password` (protected); validate all request bodies with `validateBody`
- [ ] T041t Write Vitest unit tests for `authService.ts` in `courtify/backend/tests/unit/authService.test.ts` (TDD — written before/alongside T039): cover `login` success, wrong password, account lockout after 5 failures, lockout expiry, `issueTokens` cookie shape, `refreshTokens` token_version mismatch → AuthError, `changePassword` increments token_version, `setupTotp` generates valid base32 secret, `verifyTotpSetup` stores hashed recovery codes, `useRecoveryCode` single-use enforcement; use in-memory SQLite
- [ ] T041c [P] Write Supertest contract tests for auth routes in `courtify/backend/tests/contract/auth.contract.test.ts`: `POST /login` → 200 + cookies set; `POST /login` wrong pw → 401; `POST /login` 5× → 423 lockout body; `GET /me` no cookie → 401; `POST /refresh` valid cookie → 200 new cookies; `PUT /password` → 200 + old token_version invalidated; request bodies validated (Zod 400 on bad schema)
- [ ] T042 [P] Implement `AuthContext` + silent refresh in `courtify/frontend/src/lib/auth.ts`: React context providing `user`, `login()`, `logout()`, `isAuthenticated`; intercept 401 API responses → call `POST /api/v1/auth/refresh` → retry original request once; no user interruption or data loss on active form use
- [ ] T043 [P] Implement `Login.tsx` page in `courtify/frontend/src/pages/Login.tsx`: email + password form (React Hook Form + Zod validation), TOTP challenge step (shown conditionally after successful password auth when 2FA is enabled), lockout error message after 5 failures, redirect to Dashboard on full auth success
- [ ] T044 [P] Implement 2FA management UI as Security tab inside `courtify/frontend/src/pages/Settings.tsx`: "Enable 2FA" flow (button → fetch QR → display QR code image → verify code input → success), "Disable 2FA" with confirmation, recovery codes display (shown once at setup)

**Checkpoint**: Authentication fully functional. All routes except /login and /auth/refresh are JWT-protected.

---

## Phase 4: User Story 1 — Dashboard Overview (Priority: P1) 🎯 MVP

**Goal**: Complete financial overview on one screen at 1280px+: net worth hero (VND M/B/T shorthand, growth badge), four asset-class cards with sparklines, allocation donut chart (always sums to 100%), five most recent ledger entries with status pills.

**Independent Test**: Open app with seeded data → Dashboard renders with correct net worth total, four asset cards with accurate values and % growth, donut chart with correct allocations summing to 100%, 5 recent transactions showing date/description/amount/StatusPill.

- [ ] T045 Implement `portfolioService.ts` in `courtify/backend/src/services/portfolioService.ts`: `getDashboardData()` aggregating: total net worth = metals + markets + liquidity + real_estate; Metals = SUM(metals_holdings current_value) + SUM(asset_lots current_value WHERE asset_class=metals, status IN active/partial_closed); Markets = SUM(asset_lots current_value WHERE asset_class=markets); Liquidity = SUM(savings_instruments principal + accrued_interest); Real Estate = SUM(ledger_entries amount WHERE asset_class=real_estate, deleted_at IS NULL); % change vs previous net_worth_snapshot; sparkline data (last 6 per-class snapshots); 5 most recent non-deleted ledger entries; upsert `net_worth_snapshots` for today
- [ ] T046 Implement dashboard route `GET /api/v1/dashboard` in `courtify/backend/src/routes/dashboard.ts`: protected by auth middleware, returns full dashboard payload per `contracts/dashboard.md`; target p95 ≤ 200ms
- [ ] T046t Write Vitest unit tests for `portfolioService.ts` in `courtify/backend/tests/unit/portfolioService.test.ts`: cover net worth aggregation across all asset sources, % change vs previous snapshot, sparkline data (6 per-class snapshots), empty portfolio returns 0 VND, Metals total = metals_holdings + asset_lots(metals); use in-memory SQLite with seeded data
- [ ] T046c [P] Write Supertest contract test for `GET /api/v1/dashboard` in `courtify/backend/tests/contract/dashboard.contract.test.ts`: authenticated → 200 + payload matches schema; unauthenticated → 401; response fields match `contracts/dashboard.md` (no internal fields leaked)
- [ ] T047 [P] Implement `SparklineBar` chart component using Recharts `BarChart` in `courtify/frontend/src/components/charts/SparklineBar.tsx`: mini bar chart for asset card trend display, no axes/labels, colored bars
- [ ] T048 [P] Implement `AllocationDonut` chart component using Recharts `PieChart` in `courtify/frontend/src/components/charts/AllocationDonut.tsx`: donut chart with legend, hides empty (0%) slices, VND shorthand labels, always sums to 100%
- [ ] T049 Implement `Dashboard.tsx` page in `courtify/frontend/src/pages/Dashboard.tsx`: fetch `GET /api/v1/dashboard`, render net worth hero (formatVND + M/B/T abbreviation, growth badge green=positive/red=negative), four asset-class cards (name, value, % change with color, SparklineBar), AllocationDonut chart, 5-row recent ledger table (date, type icon, description, counterparty, ±VND, StatusPill); skeleton screens while loading; EmptyState when all values are 0 VND

**Checkpoint**: Dashboard fully functional with real data from seeded DB. This is the MVP.

---

## Phase 5: User Story 2 — Ledger Management (Priority: P2)

**Goal**: Full transaction history with server-side pagination (50 rows/page), filtering (asset class, entry type, date range, status), column sorting — all applied at DB query level. Inline edit and soft-delete (sets deleted_at, excluded from all calculations).

**Independent Test**: Navigate to Ledger → apply asset_class filter → verify only matching rows; click Amount header → rows reorder; navigate to page 2; edit a row field → verify Dashboard net worth updates; soft-delete a row → verify hidden from Ledger + excluded from Dashboard.

- [ ] T050 Implement `ledgerService.ts` in `courtify/backend/src/services/ledgerService.ts`: `listEntries({assetClass, entryType, dateFrom, dateTo, status, sort, sortDir, page})` with server-side WHERE (excludes `deleted_at IS NOT NULL`) + ORDER BY + LIMIT 50 OFFSET; returns rows array + `total_count` + `current_page`; `createEntry(data)` + upsert snapshot; `updateEntry(id, data)` + upsert snapshot; `softDeleteEntry(id)` sets `deleted_at=NOW()` + upsert snapshot; `getEntryById(id)`
- [ ] T051 Implement ledger routes in `courtify/backend/src/routes/ledger.ts`: `GET /api/v1/ledger` (query params: asset_class, entry_type, date_from, date_to, status, sort, sort_dir, page; returns rows+total_count+current_page), `POST /api/v1/ledger`, `PUT /api/v1/ledger/:id`, `DELETE /api/v1/ledger/:id` (soft delete, confirm=true required); all protected
- [ ] T051t Write Vitest unit tests for `ledgerService.ts` in `courtify/backend/tests/unit/ledgerService.test.ts`: cover pagination offset/limit calculation, filter WHERE clauses (asset_class, status, date range), sort direction applied to query, soft-delete sets deleted_at (row retained in DB), create/update triggers net_worth_snapshots upsert, soft-deleted rows excluded from all list results; in-memory SQLite
- [ ] T051c [P] Write Supertest contract tests for ledger routes in `courtify/backend/tests/contract/ledger.contract.test.ts`: `GET /api/v1/ledger` → 200 + {rows, total_count, current_page}; filter params applied server-side; `POST` → 201 + new entry; `PUT /:id` → 200; `DELETE /:id` without confirm=true → 400; `DELETE /:id` confirm=true → 200; unauthenticated → 401
- [ ] T052 Implement `Ledger.tsx` page in `courtify/frontend/src/pages/Ledger.tsx`: filter toolbar (asset class dropdown, entry type dropdown, date range picker, status dropdown), table with columns (date/time, type icon, description, counterparty/method, ±VND amount, StatusPill), column header click → toggle sort + sort direction indicator, Prev/Next pagination controls + total entry count display, edit row via modal (React Hook Form + Zod prefilled), soft-delete with confirmation dialog, skeleton screen on load, EmptyState when no results

**Checkpoint**: Ledger fully functional with server-side filters, sort, pagination, edit, and soft-delete.

---

## Phase 6: User Story 8 — Loan & Debt Management (Priority: P3)

**Goal**: Dedicated loan page with summary cards (Total Lent, Total Borrowed, Net Balance), filterable/sortable table, installment payment recording, computed remaining balance and status (Active/Overdue/Settled), auto-generated `loan_settled` calendar event on payoff.

**Independent Test**: Create Lent loan 15M VND to "Le Nam" with 3 installments → record 1st payment 5M → verify remaining=10M, status=Active; let due date pass → status=Overdue amber; record remaining 10M → status=Settled + calendar event created.

- [ ] T053 Implement `loanService.ts` in `courtify/backend/src/services/loanService.ts`: `listLoans({type, status, sort, sortDir})` computing `remaining_balance = principal − SUM(paid loan_payments)` and `status` (settled if balance≤0, overdue if balance>0 and earliest unpaid payment due_date < TODAY, else active) at query time; `createLoan(data)` with initial installment records; `updateLoan(id, data)`; `deleteLoan(id)` — 422 if payments exist (requires explicit force flag); `addPayment(loanId, payment)` with validation (paid_amount ≤ remaining balance), update payment status, if balance reaches 0 update loan status to settled + auto-create `loan_settled` calendar event via `calendarEventHelpers.createLoanSettledEvent(db, loanId, date)` (T024b — NOT calendarService to avoid circular import); `listPayments(loanId)`
- [ ] T054 Implement loans routes in `courtify/backend/src/routes/loans.ts`: `GET /api/v1/loans` (filter: type, status; sort: counterparty, amount, due_date, status), `POST /api/v1/loans`, `PUT /api/v1/loans/:id`, `DELETE /api/v1/loans/:id`, `GET /api/v1/loans/:id/payments`, `POST /api/v1/loans/:id/payments`; all protected
- [ ] T054t Write Vitest unit tests for `loanService.ts` in `courtify/backend/tests/unit/loanService.test.ts`: cover remaining_balance computation (`principal − SUM(paid_payments)`), status transitions (active→overdue on past due_date, overdue→settled on balance=0), overpayment rejected with BusinessRuleError, payment auto-creates loan_settled calendar event via T024b helpers, delete with payments throws 422; in-memory SQLite
- [ ] T054c [P] Write Supertest contract tests for loans routes in `courtify/backend/tests/contract/loans.contract.test.ts`: `GET /api/v1/loans` → 200 + computed remaining_balance + status; `POST /api/v1/loans` → 201; `POST /:id/payments` overpayment → 422; `DELETE` with existing payments → 422; unauthenticated → 401
- [ ] T055 Implement `Loans.tsx` page in `courtify/frontend/src/pages/Loans.tsx`: summary cards (Total Lent, Total Borrowed, Net Balance in VND shorthand), filter bar (type: All/Lent/Borrowed/Settled; sort controls), table (Recipient/Lender, Principal VND, Remaining Balance VND, Date Issued, Due Date, Status pill amber=Overdue/green=Active/gray=Settled, Actions), expandable installment panel per loan (list of payments with due date/amounts/status, "Record Payment" button), "Record New Loan" modal (React Hook Form + Zod: type selector Lent/Borrowed, counterparty name, principal VNDInput, date issued, expected due date, repayment terms text, description), delete with confirmation warning when payments exist, EmptyState

**Checkpoint**: Loan & Debt Management fully functional with installment tracking and automatic status transitions.

---

## Phase 7: User Story 3 — Savings Instruments (Priority: P3)

**Goal**: Savings page listing all 4 instrument types with institution, principal, rate, maturity date, auto-computed accrued interest; amber maturity cell on past-due instruments; auto-generated `maturity` calendar event on creation.

**Independent Test**: Open Savings page with seeded data → each row shows institution, type badge, principal VND, rate %, maturity date (amber if past), accrued interest VND; add new CD → appears with correct accrued interest; check Calendar page → maturity event created.

- [ ] T056 Implement `savingsService.ts` in `courtify/backend/src/services/savingsService.ts`: `listInstruments()` computing `accrued_interest = CAST(principal AS REAL) × (CAST(interest_rate AS REAL)/100) × (days_elapsed/365.0)` and status (`active` → `matured` if maturity_date ≤ TODAY) at query time; `createInstrument(data)` + auto-create `maturity` calendar event via `calendarEventHelpers.createMaturityEvent(db, savingsId, maturityDate, principal)` (T024b — NOT calendarService); `updateInstrument(id, data)`; `deleteInstrument(id)` (hard delete, removes linked calendar event from `calendar_events` table directly via db)
- [ ] T057 Implement savings routes in `courtify/backend/src/routes/savings.ts`: `GET /api/v1/savings`, `POST /api/v1/savings`, `PUT /api/v1/savings/:id`, `DELETE /api/v1/savings/:id`; all protected
- [ ] T057t Write Vitest unit tests for `savingsService.ts` in `courtify/backend/tests/unit/savingsService.test.ts`: cover accrued_interest formula (`principal × rate/100 × days_elapsed/365.0`), matured status when maturity_date ≤ TODAY, create auto-generates maturity calendar_event via T024b, guard against divide-by-zero (0-day instruments); in-memory SQLite
- [ ] T057c [P] Write Supertest contract tests for savings routes in `courtify/backend/tests/contract/savings.contract.test.ts`: `GET /api/v1/savings` → 200 + `accrued_interest` field present; `POST` → 201 + linked calendar event created; `DELETE` → 200 + linked calendar event deleted; unauthenticated → 401
- [ ] T058 Implement `Savings.tsx` page in `courtify/frontend/src/pages/Savings.tsx`: table (institution name, instrument type badge, principal VND, rate % p.a., maturity date cell amber if matured, accrued interest VND), "Add Savings Entry" modal (React Hook Form + Zod: institution dropdown, instrument type selector 4 options, label, principal VNDInput, annual interest rate %, start date, maturity date with validation maturity > start), EmptyState

**Checkpoint**: Savings instruments fully functional with accrued interest calculation and auto-maturity calendar events.

---

## Phase 8: User Story 4 — Metals Ledger (Priority: P3)

**Goal**: Metals page tracking physical gold/silver with weight unit conversion (chỉ/lượng/gram → canonical grams in DB), purity, purchase and current price per gram, computed unrealized gain/loss. Dashboard Metals card aggregates both `metals_holdings` AND `asset_lots` where `asset_class=metals`.

**Independent Test**: Open Metals page with seeded data → each row shows metal type, weight in original unit, purity %, purchase price/gram, current value VND; add gold entry in chỉ (3.75g) → stored as grams; verify Dashboard Metals card total = metals_holdings total + metals asset_lots total.

- [ ] T059 Implement `metalsService.ts` in `courtify/backend/src/services/metalsService.ts`: `listHoldings()` computing `purchase_value = weight_grams × purchase_price_per_gram`, `current_value = weight_grams × current_price_per_gram`, `unrealised_gain = current_value − purchase_value` at query time; `createHolding(data)` converting `weight_display + weight_unit` → `weight_grams` (chỉ=3.75g, lượng=37.5g, gram=1g) before write; `updateHolding(id, data)` (price update recalculates); `deleteHolding(id)` (hard delete)
- [ ] T060 Implement metals routes in `courtify/backend/src/routes/metals.ts`: `GET /api/v1/metals`, `POST /api/v1/metals`, `PUT /api/v1/metals/:id`, `DELETE /api/v1/metals/:id`; all protected
- [ ] T060t Write Vitest unit tests for `metalsService.ts` in `courtify/backend/tests/unit/metalsService.test.ts`: cover unit conversions (chỉ×3.75=gram, lượng×37.5=gram), purchase_value and current_value calculations, unrealised_gain sign (positive/negative), weight stored as canonical grams TEXT; in-memory SQLite
- [ ] T060c [P] Write Supertest contract tests for metals routes in `courtify/backend/tests/contract/metals.contract.test.ts`: `POST` with weight_unit=chỉ → stored weight_grams=input×3.75; `GET` → `unrealised_gain` field present; invalid weight_unit → 400 VALIDATION_ERROR; unauthenticated → 401
- [ ] T061 Implement `Metals.tsx` page in `courtify/frontend/src/pages/Metals.tsx`: table (metal type Gold/Silver, weight display in original unit, weight unit, purity %, purchase price/gram VND, current value VND, unrealized gain/loss colored green/red), inline current price edit (click cell → input → Enter saves via PATCH), "Add Metal Entry" modal (React Hook Form + Zod: metal type, weight number, weight unit dropdown chỉ/lượng/gram, purity 0–100 %, purchase price/gram VNDInput, current price/gram VNDInput, purchase date, institution optional), EmptyState

**Checkpoint**: Metals ledger fully functional. Dashboard Metals card correctly aggregates both metals_holdings and metals asset_lots.

---

## Phase 9: Investment Ledger — Lot-Based Trading with FIFO (Priority: P3)

**Goal**: Investment Ledger page with tabs (Gold/Silver, Stocks/Crypto, Savings/Funds, Real Estate); Lot view (default) and Aggregated toggle; BUY creates lot + immutable transaction; SELL applies FIFO matching → per-lot realized P&L stored; inline current price edit per lot; Trade History tab.

**Independent Test**: Open Investment Ledger → Lot view shows each lot row; toggle Aggregated → single row with weighted avg cost; add BUY 100 FPT at 90,000 VND; add SELL 150 FPT (needs 2 lots) → verify 2 asset_transactions rows with realized_pnl; click Current Price cell → edit → Enter → % change updates immediately.

- [ ] T062 Implement pure FIFO lot-matching function in `courtify/backend/src/lib/fifo.ts`: `fifoMatch(lots: {id, remainingVolume, buyPricePerUnit}[], sellVolume: number): {lotId, volumeConsumed, lotBuyPrice}[]` — orders by purchase_date ASC, consumes oldest lots first, validates total available ≥ sellVolume (throws if insufficient), no DB side-effects
- [ ] T063 Implement `lotService.ts` in `courtify/backend/src/services/lotService.ts`: `listLots(assetClass, subtype, view)` — lot view returns all active/partial_closed rows with computed `current_value`, `unrealised_pnl`, `pct_change`; aggregated view GROUPs BY asset_name computing `total_remaining_volume`, `weighted_avg_cost = SUM(remaining_volume × buy_price_per_unit) / SUM(remaining_volume)`, `total_current_value`, `blended_pct_change`; `buyLot(data)` creates `asset_lots` row + `asset_transactions` BUY row in a single DB transaction + upserts snapshot; `sellLot({assetName, sellVolume, sellPrice, fee, date})` runs `fifoMatch()`, writes multiple SELL `asset_transactions` rows with `realized_pnl = (sellPrice − lotBuyPrice) × volumeConsumed`, updates `remaining_volume` + `status` on each consumed lot atomically, upserts snapshot; `updateLotPrice(lotId, newPrice)` PATCH `current_price_per_unit`; `listTradeHistory({assetClass, dateFrom, dateTo})` returns all SELL transactions joined with lot buy price and realized_pnl
- [ ] T064 Implement investment lots routes in `courtify/backend/src/routes/lots.ts`: `GET /api/v1/lots` (query: asset_class, subtype, view=lot|aggregated), `POST /api/v1/lots` (BUY), `POST /api/v1/lots/sell` (SELL FIFO), `PATCH /api/v1/lots/:id/price`, `GET /api/v1/lots/history` (query: asset_class, date_from, date_to); all protected
- [ ] T062t Write Vitest unit tests for `fifo.ts` pure function in `courtify/backend/tests/unit/fifo.test.ts`: single-lot exact fill, multi-lot spill-over, insufficient volume throws, FIFO ordering by purchase_date ASC, realized_pnl per segment = (sellPrice − lotBuyPrice) × volume; no DB dependency (pure function)
- [ ] T064t Write Vitest unit tests for `lotService.ts` in `courtify/backend/tests/unit/lotService.test.ts`: BUY creates asset_lots + asset_transactions in single DB transaction, SELL runs fifoMatch → updates remaining_volume + status on consumed lots + inserts SELL asset_transactions with realized_pnl, aggregated view returns weighted_avg_cost, price update does NOT propagate to other lots of same asset; in-memory SQLite
- [ ] T064c [P] Write Supertest contract tests for lots routes in `courtify/backend/tests/contract/lots.contract.test.ts`: `POST /api/v1/lots` (BUY) → 201; `POST /sell` sell > available volume → 422; `GET ?view=aggregated` → single row per asset_name with weighted_avg_cost; `PATCH /:id/price` → 200 + pct_change recalculated; unauthenticated → 401; asset_transactions are append-only (no UPDATE/DELETE)
- [ ] T065 Implement `InvestmentLedger.tsx` page in `courtify/frontend/src/pages/InvestmentLedger.tsx`: tabs (Gold/Silver, Stocks/Crypto, Savings/Funds, Real Estate) each fetching with respective asset_class/subtype; Lot view table (asset name, purchase date, buy price/unit VND, current price/unit VND with inline click-to-edit → Enter saves via PATCH, volume + unit label, % change colored); Aggregated toggle (session-only, collapses to single row per asset_name showing total volume, weighted avg cost, current price, total value, blended % change); Trade History tab (date, volume sold, sell price, lot buy price, realized P&L per SELL colored); "Add Investment" modal (React Hook Form + Zod: asset name, subtype, institution dropdown, purchase date, volume, buy price/unit VNDInput, current price/unit VNDInput, unit label, notes); "Record Sell" modal (asset name input, sell volume, sell price/unit VNDInput, fee VNDInput, date); EmptyState per tab

**Checkpoint**: Investment Ledger fully functional with lot-based tracking, FIFO sell matching, realized P&L, and aggregated view.

---

## Phase 10: User Story 5 — Financial Calendar (Priority: P4)

**Goal**: Timeline of financial events (maturity dates, debt due dates, savings goals, loan_settled) sorted by due_date; amber highlight + warning icon for events ≤ 7 days; click event → detail panel (title, amount, date, type, linked asset).

**Independent Test**: Seed maturity event 5 days out + debt due 25 days out → open Calendar → both events appear; near-term event has amber/warning indicator; click event → detail shows all fields.

- [ ] T066 Implement `calendarService.ts` in `courtify/backend/src/services/calendarService.ts`: `listEvents({eventType?, includeDismissed?})` sorted by `due_date ASC`, includes computed `days_until = due_date − TODAY`; `createEvent(data)`; `updateEvent(id, data)`; `deleteEvent(id)`; `dismissEvent(id)` sets `is_dismissed=1`; auto-creation helpers `createMaturityEvent(savingsId, date, amount)` and `createLoanSettledEvent(loanId, date)` called from other services
- [ ] T067 Implement calendar routes in `courtify/backend/src/routes/calendar.ts`: `GET /api/v1/calendar` (query: event_type, include_dismissed), `POST /api/v1/calendar`, `PUT /api/v1/calendar/:id`, `DELETE /api/v1/calendar/:id`, `PATCH /api/v1/calendar/:id/dismiss`; all protected
- [ ] T067t Write Vitest unit tests for `calendarService.ts` in `courtify/backend/tests/unit/calendarService.test.ts`: cover `days_until` computation (positive, zero, negative), events sorted by due_date ASC, dismissed events excluded unless include_dismissed=true; in-memory SQLite
- [ ] T067c [P] Write Supertest contract tests for calendar routes in `courtify/backend/tests/contract/calendar.contract.test.ts`: `GET` without include_dismissed → dismissed events absent; `PATCH /:id/dismiss` → 200 + is_dismissed=1; `GET` include_dismissed=true → dismissed events present; unauthenticated → 401
- [ ] T068 Implement `Calendar.tsx` page in `courtify/frontend/src/pages/Calendar.tsx`: timeline list sorted by due_date, amber highlight + warning icon for events with `days_until ≤ 7`, click event → detail side panel (title, amount VND if present, due date, event type badge, linked asset class); "Add Event" modal (React Hook Form + Zod: title, event type selector, due date, amount optional VNDInput, asset class optional, notes); dismiss button per event; EmptyState

**Checkpoint**: Calendar fully functional with urgency highlighting, detail panel, and auto-generated events from Savings/Loans.

---

## Phase 11: User Story 6 — Analytics (Priority: P4)

**Goal**: Net worth line chart (3M/6M/1Y/All), grouped bar chart (asset class performance per period), predictive projection toggle (3-month trailing avg growth → dashed forecast line, ≤ 500ms), Realized P&L summary (from SELL asset_transactions, filterable by asset class and date range).

**Independent Test**: Seed 12 months of snapshots → line chart shows 12 data points; switch time range → chart updates; enable projection → dashed line renders in ≤ 500ms; grouped bar shows 4 bars per period; Realized P&L summary shows correct totals per asset class.

- [ ] T069 Implement `analyticsService.ts` in `courtify/backend/src/services/analyticsService.ts`: `getNetWorthHistory(range: '3M'|'6M'|'1Y'|'all')` queries `net_worth_snapshots` filtered by date range; `getAssetClassPerformance(range)` returns per-class values per snapshot grouped by period; `getProjection(range)` computes trailing average monthly growth rate from snapshots → extends 3 periods forward as `{date, projected_total}[]`; `getRealizedPnl({assetClass?, dateFrom?, dateTo?})` aggregates `SUM(realized_pnl)` from SELL `asset_transactions` joined with `asset_lots` for class filtering
- [ ] T070 Implement analytics routes in `courtify/backend/src/routes/analytics.ts`: `GET /api/v1/analytics/net-worth` (query: range), `GET /api/v1/analytics/performance` (query: range), `GET /api/v1/analytics/projection` (query: range), `GET /api/v1/analytics/pnl` (query: asset_class, date_from, date_to); all protected
- [ ] T070t Write Vitest unit tests for `analyticsService.ts` in `courtify/backend/tests/unit/analyticsService.test.ts`: cover range filtering (3M/6M/1Y/all date boundaries), projection using trailing 3-month average (guard divide-by-zero on <2 data points), realized P&L aggregation by asset_class, empty snapshot history → empty array (not error); in-memory SQLite
- [ ] T070c [P] Write Supertest contract tests for analytics routes in `courtify/backend/tests/contract/analytics.contract.test.ts`: `GET /net-worth?range=3M` → 200 + array of {date, total_value}; `GET /projection` → projected 3 future data points; `GET /pnl` → {total_realized_pnl, by_class:[]}; unauthenticated → 401
- [ ] T071 [P] Implement `NetWorthLine` chart component using Recharts `LineChart` in `courtify/frontend/src/components/charts/NetWorthLine.tsx`: selectable time range buttons (3M/6M/1Y/All), dashed projection line overlay (different stroke-dasharray) when projection data provided, VND shorthand Y-axis labels
- [ ] T072 [P] Implement `AssetGroupedBar` chart component using Recharts `BarChart` in `courtify/frontend/src/components/charts/AssetGroupedBar.tsx`: 4 grouped bars per period (one per asset class), VND shorthand value labels, color-coded per class
- [ ] T073 Implement `Analytics.tsx` page in `courtify/frontend/src/pages/Analytics.tsx`: NetWorthLine chart with time range selector, projection toggle (client-side fetch + render in ≤ 500ms, no page reload per SC-007), AssetGroupedBar chart, Realized P&L summary section (asset class filter dropdown, date range picker, table showing P&L per class + grand total); skeleton screens; EmptyState when no snapshot data

**Checkpoint**: Analytics page fully functional with trend visualization, projection, and realized P&L.

---

## Phase 12: User Story 7 — Settings & Institutions (Priority: P5)

**Goal**: Profile tab (name, email, title, avatar upload), Security tab (change password, 2FA from Phase 3), Institutions tab (CRUD + soft-archive, hard-delete blocked if referenced), Notifications tab (advance days 1/3/7/30), Localization tab (currency, timezone read-only v1). Institution changes immediately reflected in all dropdowns.

**Independent Test**: (1) Add institution "VP Bank" → open Ledger form → appears in institution dropdown. (2) Update Full Name → sidebar shows updated name. (3) Archive institution → dropdown no longer shows it; existing Ledger rows show "(Archived)". (4) Set 7-day notification → event within 7 days → Header badge lit.

- [ ] T074 Implement `institutionService.ts` in `courtify/backend/src/services/institutionService.ts`: `listInstitutions(includeArchived?)` — active only for dropdowns; archived shown with "(Archived)" label when includeArchived=true; `createInstitution(data)`; `updateInstitution(id, data)`; `archiveInstitution(id)` sets `archived_at=NOW()`; `restoreInstitution(id)` clears `archived_at`; `deleteInstitution(id)` — checks FK references in ledger_entries, savings_instruments, metals_holdings, asset_lots; returns 422 BusinessRuleError if any exist; hard deletes only if no references
- [ ] T075 Implement institutions routes in `courtify/backend/src/routes/institutions.ts`: `GET /api/v1/institutions` (query: include_archived), `POST /api/v1/institutions`, `PUT /api/v1/institutions/:id`, `DELETE /api/v1/institutions/:id` (422 if referenced, else archive), `POST /api/v1/institutions/:id/restore`; all protected
- [ ] T075t Write Vitest unit tests for `institutionService.ts` in `courtify/backend/tests/unit/institutionService.test.ts`: cover archive hides from dropdown (active-only list), restore clears archived_at, deleteInstitution throws 422 when FK references exist (ledger_entries, savings_instruments, metals_holdings, asset_lots), hard-delete succeeds when no references; in-memory SQLite
- [ ] T075c [P] Write Supertest contract tests for institutions routes in `courtify/backend/tests/contract/institutions.contract.test.ts`: `GET` (no param) → only active institutions; `GET ?include_archived=true` → includes archived with "(Archived)"; `DELETE` referenced institution → 422; `POST /:id/restore` → 200; unauthenticated → 401
- [ ] T076 Implement settings/profile routes in `courtify/backend/src/routes/settings.ts`: `GET /api/v1/settings`, `PUT /api/v1/settings` (notification_days_advance JSON array, timezone, currency); `GET /api/v1/settings/profile`, `PUT /api/v1/settings/profile` (full_name, email, professional_title), `POST /api/v1/settings/avatar` (multer single-file upload, stored to `/app/uploads/avatars/{userId}.{ext}`, returns avatar_path); all protected
- [ ] T077 Implement `Settings.tsx` page in `courtify/frontend/src/pages/Settings.tsx`: tabbed layout — Profile tab (full_name, email, professional_title fields + avatar upload with preview, React Hook Form + Zod, save updates sidebar user area), Security tab (Change Password form requiring current password, 2FA enable/disable from Phase 3 T044), Institutions tab (table: name, type badge, archived status; Add/Edit buttons, Archive button → archived rows grayed with "(Archived)" chip; hard-delete blocked with 422 error shown; restore archived), Notifications tab (checkboxes for 1/3/7/30 days advance notice, saved to settings), Localization tab (currency=VND readonly, timezone=Asia/Ho_Chi_Minh readonly in v1)
- [ ] T076c [P] Write Supertest contract tests for settings routes in `courtify/backend/tests/contract/settings.contract.test.ts`: `GET /settings` → 200 + {notification_days_advance, timezone}; `PUT /settings/profile` → 200 + updated fields; `POST /settings/avatar` → 200 + avatar_path; response MUST NOT include password_hash or totp_secret (output validation); unauthenticated → 401

**Checkpoint**: Settings fully functional. Institution management, profile updates, and notification preferences all working.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: WCAG compliance, E2E tests for critical journeys, performance validation, edge case handling, quickstart verification.

- [ ] T078 [P] Audit and fix WCAG 2.1 AA violations across all pages in `courtify/frontend/src/`: verify dark-mode contrast ratios, add ARIA labels to all icon-only buttons, ensure focus management in all modals (focus trap, close on Escape)
- [ ] T079 [P] Verify `net_worth_snapshots` upsert is called in all backend mutation services that affect asset values: ledgerService (create/update/soft-delete), savingsService (create/update/delete), metalsService (create/update/delete), lotService (buy/sell), loanService (payment recorded); fix any missing upsert calls in `courtify/backend/src/services/`
- [ ] T080 [P] Implement notification badge logic in `courtify/frontend/src/components/layout/Header.tsx`: poll `GET /api/v1/calendar` on page load + after mutations; show indicator badge when any active event has `days_until ≤ settings.notification_days_advance`
- [ ] T081 [P] Write Playwright E2E test for critical journey: Login → Dashboard renders → apply Ledger filter → add Ledger entry → verify Dashboard net worth updates in `courtify/frontend/tests/e2e/dashboard-ledger.spec.ts`
- [ ] T082 [P] Write Playwright E2E test for Auth journey: unauthenticated redirect → login → 2FA setup → logout → login with TOTP → Dashboard in `courtify/frontend/tests/e2e/auth.spec.ts`
- [ ] T083 [P] Write Playwright E2E test for Loan journey: create loan → record installment → verify remaining balance → record final payment → verify Settled + calendar event in `courtify/frontend/tests/e2e/loans.spec.ts`
- [ ] T084 [P] Validate all monetary display formatting across all pages: negative values red with minus prefix, M/B/T shorthand thresholds, 4-decimal-place DB storage; fix any regressions in `courtify/frontend/src/lib/vnd.ts`
- [ ] T085 [P] Performance validation: verify `GET /api/v1/dashboard` p95 ≤ 200ms with seeded data; verify `GET /api/v1/ledger` with 1000 entries returns page in ≤ 200ms; verify full Dashboard page (frontend + API) loads in ≤ **2 s** (SC-001 / Constitution IV — not 3 s); verify Ledger 50-row page renders in ≤ 1s total (SC-005); add DB indexes if needed; CI job in T008b enforces these thresholds automatically
- [ ] T085b [P] Write Playwright visual regression test for Calendar page urgency highlighting in `courtify/frontend/tests/e2e/calendar-visual.spec.ts` (SC-006): seed event 3 days out + event 20 days out → screenshot → assert amber class present on near-term event and absent on far event; run as part of CI visual-regression job (Constitution IV)
- [ ] T086 Run quickstart.md validation: `docker compose up --build` → seed → login → navigate all pages → verify no errors; fix any startup/seed/migration issues in `courtify/backend/src/db/seed.ts`, `courtify/backend/src/index.ts`, or `courtify/docker-compose.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US9 Auth)**: Depends on Phase 2 — **BLOCKS all page access**
- **Phase 4 (US1 Dashboard)**: Depends on Phase 3 — MVP delivery target
- **Phases 5–12 (US2–US7 + Investment Ledger)**: Depend on Phase 3; can proceed in parallel after Phase 3
- **Phase 13 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Phase | Depends On | Parallelizable With |
|-------|-------|-----------|---------------------|
| US9 Auth | 3 | Phase 2 | — |
| US1 Dashboard | 4 | Phase 3 | — |
| US2 Ledger | 5 | Phase 3 | US8, US3, US4, Investment |
| US8 Loans | 6 | Phase 3 | US2, US3, US4, Investment |
| US3 Savings | 7 | Phase 3 | US2, US8, US4, Investment |
| US4 Metals | 8 | Phase 3 | US2, US8, US3, Investment |
| Investment Ledger | 9 | Phase 3 | US2, US8, US3, US4 |
| US5 Calendar | 10 | Phase 3 (calendarService full impl; auto-event helpers already in T024b) | US6 |
| US6 Analytics | 11 | Phase 3, snapshots from Phase 4+ | US5 |
| US7 Settings | 12 | Phase 3 | US5, US6 |

### Within Each User Story

Backend service → Backend route → Frontend page (sequential within a story, all [P] tasks within a phase run in parallel)

### Parallel Opportunities

```bash
# Phase 2: All DB migrations (T012–T023) run in parallel
# Phase 2: Utilities run in parallel
Task T026: packages/types schemas
Task T028: asyncHandler.ts
Task T029: validateBody.ts
Task T031: vnd.ts formatVND
Task T032: api.ts fetch client
Task T033: VNDInput component
Task T034: StatusPill component
Task T035: EmptyState component
Task T037: Header component

# After Phase 3 completes, run in parallel:
Developer A: Phase 5 US2 Ledger (T050–T052)
Developer B: Phase 6 US8 Loans (T053–T055)
Developer C: Phase 7 US3 Savings (T056–T058)
Developer D: Phase 8 US4 Metals (T059–T061)
Developer E: Phase 9 Investment Ledger (T062–T065)
```

---

## Implementation Strategy

### MVP First (Phases 1 → 4)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — **CRITICAL, blocks everything**
3. Complete Phase 3: US9 Authentication
4. Complete Phase 4: US1 Dashboard
5. **STOP and VALIDATE**: seed data, open Dashboard, verify all data, check ≤ 3s load
6. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational + Auth → Working auth gate
2. Add Dashboard (US1) → Full MVP with financial overview
3. Add Ledger (US2) → Transaction audit trail
4. Add Loans (US8) + Savings (US3) + Metals (US4) in parallel → Complete asset tracking
5. Add Investment Ledger → Professional lot-based trading view
6. Add Calendar (US5) + Analytics (US6) → Time management + insights
7. Add Settings (US7) → Institution management + profile
8. Polish Phase → E2E, WCAG, performance

---

## Notes

- All monetary fields stored as `TEXT` (decimal string, 4 decimal places); never `REAL` or `INTEGER` in SQLite
- VND arithmetic: JS `Number` (IEEE 754) only at service layer; round to 4 dp before any DB write
- Weight unit conversions: chỉ = 3.75g, lượng = 37.5g, gram = 1g; DB always stores canonical grams
- FIFO matching is a pure function (`fifo.ts`) with no DB side effects — can be unit tested in isolation
- `net_worth_snapshots` must be upserted on every mutation that affects any asset value (not just ledger)
- Institutions use soft-archive (never hard-delete if any FK reference exists); archived shown as "(Archived)" in all history views
- All API endpoints require `auth` middleware except `POST /api/v1/auth/login` and `POST /api/v1/auth/refresh`
- Task IDs T001–T086 are in logical execution order within each phase
- [P] tasks operate on different files with no blocking dependencies and can run concurrently
