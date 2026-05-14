# Implementation Plan: COURTIFY — Wealth Management Dashboard

**Branch**: `001-courtify-wealth-dashboard` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-courtify-wealth-dashboard/spec.md`

---

## Summary

Build COURTIFY, a desktop-first personal finance management web application for high-net-worth Vietnamese individuals. The system tracks diverse asset portfolios (metals, stocks/crypto, savings instruments, real estate, loans) with a lot-based investment ledger, FIFO sell matching, realized P&L tracking, and a full analytics engine — all in VND with Vietnamese shorthand formatting. Authentication uses email + password + JWT (httpOnly cookies) with optional 2FA TOTP.

**Technical approach**: Full-stack TypeScript monorepo (Express API + React SPA) backed by SQLite 3 via `better-sqlite3` (WAL mode), containerized with Docker Compose (2 services: frontend + backend; no DB container). Asset lifecycle uses an immutable event-log (`asset_transactions`) with derived views for current positions and realized P&L.

---

## Technical Context

**Language/Version**: TypeScript 5.4+ (strict mode) — frontend and backend share a single language.

**Primary Dependencies**:
- Backend: Express 4, `better-sqlite3` (SQLite driver, sync API), `knex` (migrations), `bcryptjs`, `jsonwebtoken`, `otplib` (TOTP), `qrcode`
- Frontend: React 18, React Router 6, Vite 5, Tailwind CSS 3, shadcn/ui, Recharts 2, React Hook Form + Zod
- Validation: Zod (backend + frontend, shared schema definitions)

**Storage**: SQLite 3 via `better-sqlite3` (WAL mode). Monetary values stored as `TEXT` (decimal string e.g. `"2450000.0000"`). Weights stored as `TEXT` in canonical gram units. No DB container — file persisted via Docker named volume `sqlitedata` at `/app/data/courtify.db`.

**Testing**:
- Unit: Vitest (business logic, service layer — uses in-memory SQLite for isolation)
- Integration: Vitest + Supertest (Express route handlers with test DB)
- E2E: Playwright (critical user journeys)
- Coverage threshold: ≥ 80% on changed business-logic modules (Constitution II)

**Target Platform**: Desktop browser ≥ 1280px viewport (Chrome/Edge/Firefox latest). Not a mobile-first app; viewports < 1280px show a warning banner.

**Project Type**: Web application — separate `backend/` (Express REST API) and `frontend/` (React SPA) directories within a pnpm monorepo.

**Performance Goals**:
- Dashboard load ≤ 2 s (SC-001 / Constitution IV)
- API read p95 ≤ 200 ms (Constitution IV)
- API write p95 ≤ 500 ms (Constitution IV)
- Ledger page load (50 rows) ≤ 1 s (SC-005)
- Analytics projection toggle ≤ 500 ms (SC-007)

**Constraints**:
- Single-user installation (one User row per DB)
- All prices entered manually (no live feed API in v1)
- VND only — no multi-currency
- Vietnamese locale (Asia/Ho_Chi_Minh, GMT+07:00)
- Monetary arithmetic: JavaScript `Number` (IEEE 754 float64) at service layer only; results rounded to 4 decimal places before any DB write (TEXT decimal string); display formatting via custom `formatVND()` util (Constitution VII + FR-019)

**Scale/Scope**: ~1,000 ledger entries, ~200 lots, ~50 savings instruments, ~30 loans. Single-user single-tenant — no horizontal scaling required in v1. SQLite DB persisted via Docker named volume `sqlitedata`.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Code Quality: single responsibility, no magic numbers, zero lint errors | ✅ PASS | Zod schemas as single source of truth; named constants for enums; ESLint strict config planned |
| I — Cyclomatic complexity ≤ 10 | ✅ PASS | FIFO lot-matching extracted to dedicated service; average cost computation in DB query |
| II — TDD (Red-Green-Refactor mandatory) | ✅ PASS | Tasks template enforces test-first; Vitest + Testcontainers for API integration |
| II — ≥ 80% unit coverage on business logic | ✅ PASS | Coverage gate in CI; `better-sqlite3` services use in-memory SQLite DB for isolated unit testing |
| II — Contract tests for every public endpoint | ✅ PASS | Zod request/response schemas serve as executable contracts; Supertest contract tests |
| III — Unified design system (tokens, spacing) | ✅ PASS | shadcn/ui + Tailwind CSS design tokens; single `globals.css` token file |
| III — Loading / empty / error states for all data views | ✅ PASS | Required by spec Edge Cases section; Skeleton components from shadcn |
| III — WCAG 2.1 AA | ⚠️ PARTIAL | Dark-mode contrast ratios must be verified; ARIA labels required on icon-only buttons |
| IV — Dashboard ≤ 2 s initial load | ✅ PASS | SC-001 updated to 2 s (aligned with Constitution IV; previous 3 s value corrected) |
| IV — API read ≤ 200 ms p95 | ✅ PASS | Pagination + indexed queries ensure this at 1,000-row scale |
| IV — Skeleton screens for ops > 300 ms | ✅ PASS | Planned for Ledger, Analytics, Dashboard |

**Complexity Tracking** (Constitution violations requiring justification):

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|-------------------------------------|
| `asset_transactions` immutable event log | Enables time-travel analytics, realized P&L, audit trail | A mutable position table cannot reconstruct historical net worth for line charts |
| Separate `packages/types` shared package | Eliminates API/UI type drift on monetary fields (VND TEXT decimal ↔ display string serialisation) | Duplicating Zod schemas causes silent mismatches on VND precision |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-courtify-wealth-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── auth.md
│   ├── dashboard.md
│   ├── investment-lots.md         # Core: GET/POST /lots, SELL FIFO, PATCH price
│   ├── investment-metals.md       # Gold/Silver: weight/purity, unit conversion
│   ├── investment-funds.md        # Chứng chỉ quỹ: mutual_fund, etf, bond_fund
│   ├── investment-real-estate.md  # BĐS: apartment, land, commercial
│   ├── investment-history.md      # Trade history & Realized P&L (shared with Analytics)
│   ├── savings.md
│   ├── loans.md
│   ├── analytics.md
│   ├── calendar.md
│   └── settings.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
courtify/                          # pnpm monorepo root
├── package.json                   # pnpm workspace config
├── pnpm-workspace.yaml
├── docker-compose.yml             #  app services
├── .env.example
│
├── packages/
│   └── types/                     # Shared Zod schemas + inferred TS types
│       ├── src/
│       │   ├── asset.ts           # AssetClass enum, AssetLot, AssetTransaction schemas
│       │   ├── auth.ts            # Login, JWT payload schemas
│       │   ├── ledger.ts          # LedgerEntry schemas
│       │   ├── savings.ts         # SavingsInstrument schemas
│       │   ├── loan.ts            # Loan, LoanPayment schemas
│       │   ├── analytics.ts       # NetWorthSnapshot, PnL schemas
│       │   └── index.ts
│       └── package.json
│
├── backend/
│   ├── src/
│   │   ├── index.js               # Express app bootstrap
│   │   ├── config.js              # Env vars (Zod-validated)
│   │   ├── db/
│   │   │   ├── client.js          # better-sqlite3 singleton (WAL mode)
│   │   │   ├── migrations/        # knex migration files (001_users … 013_settings)
│   │   │   └── seed.js            # Seed script
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT cookie verification → req.userId
│   │   │   ├── asyncHandler.js    # Async error forwarding wrapper
│   │   │   ├── validateBody.js    # Zod schema middleware factory
│   │   │   └── errorHandler.js    # Global Express error handler
│   │   ├── routes/
│   │   │   ├── auth.js            # POST /auth/login|logout|refresh|2fa/*
│   │   │   ├── dashboard.js       # GET /dashboard
│   │   │   ├── ledger.js          # GET/POST/PUT/DELETE /ledger
│   │   │   ├── lots.js            # GET/POST /lots, POST /lots/sell, PATCH /lots/:id/price
│   │   │   ├── metals.js          # GET/POST/PUT/DELETE /metals
│   │   │   ├── savings.js         # GET/POST/PUT/DELETE /savings
│   │   │   ├── loans.js           # GET/POST/PUT/DELETE /loans, POST /loans/:id/payments
│   │   │   ├── analytics.js       # GET /analytics/net-worth, /analytics/pnl, /analytics/performance
│   │   │   ├── calendar.js        # GET/POST/PUT/DELETE /calendar
│   │   │   ├── institutions.js    # GET/POST/PUT/DELETE /institutions
│   │   │   └── settings.js        # GET/PUT /settings
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── portfolioService.js   # Dashboard aggregation, net worth
│   │   │   ├── ledgerService.js
│   │   │   ├── lotService.js         # BUY, SELL (FIFO matching), price update
│   │   │   ├── metalsService.js      # Weight conversion, metals holdings
│   │   │   ├── savingsService.js
│   │   │   ├── loanService.js
│   │   │   ├── analyticsService.js
│   │   │   ├── calendarService.js
│   │   │   └── institutionService.js
│   │   ├── schemas/
│   │   │   └── index.js           # All Zod schemas (single source of truth, Constitution V)
│   │   ├── errors.js              # BusinessRuleError, NotFoundError, AuthError
│   │   └── lib/
│   │       ├── vnd.js             # VND number formatting utilities
│   │       └── fifo.js            # FIFO lot-matching pure function
│   ├── tests/
│   │   ├── unit/                  # Vitest unit tests (services, lib) — in-memory SQLite
│   │   ├── contract/              # Vitest + Supertest contract tests (route handlers)
│   │   └── integration/           # Cross-service integration tests
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx                # Router setup
    │   ├── lib/
    │   │   ├── api.ts             # Typed fetch client (uses packages/types)
    │   │   ├── vnd.ts             # formatVND(), abbreviateVND() (M/B/T)
    │   │   └── auth.ts            # Auth context + silent refresh
    │   ├── components/
    │   │   ├── ui/                # shadcn/ui base components
    │   │   ├── layout/
    │   │   │   ├── Sidebar.tsx
    │   │   │   └── Header.tsx
    │   │   ├── charts/
    │   │   │   ├── SparklineBar.tsx
    │   │   │   ├── AllocationDonut.tsx
    │   │   │   ├── NetWorthLine.tsx
    │   │   │   └── AssetGroupedBar.tsx
    │   │   └── shared/
    │   │       ├── VNDInput.tsx   # Monetary input with auto-format
    │   │       ├── StatusPill.tsx
    │   │       └── EmptyState.tsx
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── Ledger.tsx         # General ledger (LedgerEntry)
    │   │   ├── InvestmentLedger.tsx  # Lot-based investment ledger (tabs)
    │   │   ├── Savings.tsx
    │   │   ├── Loans.tsx
    │   │   ├── Calendar.tsx
    │   │   ├── Analytics.tsx
    │   │   └── Settings.tsx
    │   └── styles/
    │       └── globals.css        # Tailwind + design tokens
    ├── tests/
    │   ├── unit/                  # Vitest (components, utils)
    │   └── e2e/                   # Playwright (critical journeys)
    └── package.json
```

**Structure Decision**: Option 2 (Web application) — separate `backend/` and `frontend/` within a pnpm monorepo. `packages/types` is the canonical source of truth for all data shapes, preventing API/UI drift on VND TEXT decimal string serialisation.
