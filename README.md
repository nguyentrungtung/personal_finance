# COURTIFY — Wealth Management Dashboard

A private, self-hosted personal finance dashboard for tracking investments, savings, loans, metals, and net worth. Desktop-first, built for high-net-worth individuals managing diverse asset portfolios in VND.

---

## Architecture

```
courtify/
├── backend/          # Express 4 + better-sqlite3 REST API (port 5000)
├── frontend/         # React 18 + Vite + Tailwind CSS (port 3000)
└── packages/types/   # Shared TypeScript types
```

- **Database**: SQLite (via `better-sqlite3`) with WAL mode — no separate DB server required
- **Auth**: JWT via HTTP-only cookies (access + refresh tokens), optional TOTP 2FA
- **Money**: All monetary values stored as `TEXT` with 4 decimal places

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| Docker + Docker Compose | For production-style startup |

Install pnpm if not present:
```bash
npm install -g pnpm@9
```

---

## Quick Start — Docker (Recommended)

```bash
cd courtify

# 1. Create environment file
cat > .env << 'EOF'
JWT_SECRET=change-me-in-production-use-a-long-random-string
JWT_EXPIRES_IN=15m
INIT_EMAIL=admin@courtify.local
INIT_PASSWORD=changeme123
VITE_API_URL=http://localhost:5000
EOF

# 2. Build and start all services
docker compose up --build
```

Services available after startup:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api/v1 |
| Health check | http://localhost:5000/api/v1/health |

The backend auto-creates the initial admin user on first start using `INIT_EMAIL` / `INIT_PASSWORD`.
Log in at http://localhost:3000/login, then change your password in **Settings → Security**.

---

## Local Development (without Docker)

### 1. Install dependencies

```bash
cd courtify
pnpm install
```

### 2. Set environment variables

Create `backend/.env`:
```env
PORT=5000
DB_PATH=./data/courtify.db
JWT_SECRET=dev-secret-key
JWT_EXPIRES_IN=7d
UPLOAD_PATH=./uploads
INIT_EMAIL=admin@test.com
INIT_PASSWORD=password
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
```

### 3. Create required directories

```bash
mkdir -p courtify/backend/data courtify/backend/uploads/avatars
```

### 4. Start backend + frontend in parallel

```bash
cd courtify
pnpm dev
```

Or start each service separately:

```bash
# Terminal 1 — Backend (http://localhost:5000)
cd courtify/backend
pnpm dev

# Terminal 2 — Frontend (http://localhost:3000)
cd courtify/frontend
pnpm dev
```

Open http://localhost:3000 in a browser **≥ 1280px wide** (desktop-first design).

---

## Running Tests

### Backend — Unit + Contract tests (Vitest + Supertest)

```bash
cd courtify/backend
pnpm test
```

Results: **22 test files, 168 tests** — all passing.

- **Unit tests**: Use in-memory SQLite — zero setup required
- **Contract tests**: Use a temporary `./data/test.db`; migrations run automatically before each file

```bash
# Run with coverage report
pnpm test:coverage
```

### Frontend — Unit tests (Vitest)

```bash
cd courtify/frontend
pnpm test
```

### E2E tests (Playwright)

Requires both backend and frontend running locally:
```bash
cd courtify/frontend
pnpm test:e2e
```

### Run all tests from monorepo root

```bash
cd courtify
pnpm test
```

---

## Database

- **Location**: Configured by `DB_PATH` env var (default: `./data/courtify.db`)
- **Migrations**: Run automatically on every backend startup via Knex
- **Manual migration**: `pnpm migrate` in `backend/`
- **Seed demo data**: `pnpm seed` in `backend/` (requires `INIT_EMAIL` + `INIT_PASSWORD`)

### Backup

```bash
# Safe online backup via SQLite CLI
sqlite3 /path/to/courtify.db ".backup backup-$(date +%Y%m%d).db"
```

---

## API Overview

All endpoints require a valid session cookie except the auth + health routes below.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Login with email + password |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `GET`  | `/api/v1/health` | Health check |

Key protected resources:

| Resource | Base Path |
|----------|-----------|
| Dashboard | `GET /api/v1/dashboard` |
| Ledger | `/api/v1/ledger` |
| Savings | `/api/v1/savings` |
| Loans | `/api/v1/loans` |
| Metals | `/api/v1/metals` |
| Investment Lots | `/api/v1/lots` |
| Calendar | `/api/v1/calendar` |
| Analytics | `/api/v1/analytics` |
| Institutions | `/api/v1/institutions` |
| Settings | `/api/v1/settings` |

---

## Features

| Module | Key Capabilities |
|--------|----------------|
| **Dashboard** | Net worth hero, asset allocation donut, recent transactions |
| **Ledger** | Filterable/sortable transaction journal with pagination; soft delete |
| **Savings** | Fixed-deposit/CD tracking with accrued interest; auto calendar events at maturity |
| **Loans** | Lent/borrowed tracking; installment payments; remaining balance; auto-settle |
| **Metals** | Gold/Silver holdings in chỉ/lượng/gram; unrealized gain/loss at spot price |
| **Investment Ledger** | FIFO lot matching for stocks/crypto; buy/sell history; trade P&L |
| **Calendar** | Upcoming events (maturities, settlements); amber highlight for events ≤ 7 days away |
| **Analytics** | Net worth trajectory (3M/6M/1Y/All); 3-period projection; realized P&L by asset class |
| **Settings** | Profile + avatar, institution management (archive/restore), notification thresholds, 2FA |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP server port |
| `DB_PATH` | `./data/courtify.db` | SQLite database file path |
| `JWT_SECRET` | — | **Required** — secret key for signing JWTs |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `UPLOAD_PATH` | `./uploads` | Directory for avatar file uploads |
| `INIT_EMAIL` | — | Email for the auto-created first admin user |
| `INIT_PASSWORD` | — | Password for the auto-created first admin user |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Backend API base URL |

---

## Project Structure

```
courtify/
├── backend/                     # Node.js + Express + better-sqlite3
│   ├── src/
│   │   ├── infrastructure/
│   │   │   ├── db/
│   │   │   │   ├── client.ts    # better-sqlite3 singleton
│   │   │   │   ├── knexfile.ts  # Knex migration config
│   │   │   │   ├── seed.ts      # Demo data seeder
│   │   │   │   └── migrations/  # Migration files (001…NNN)
│   │   │   └── middleware/      # Auth, error handler, validation
│   │   ├── modules/             # Feature modules (auth, dashboard, metals…)
│   │   │   └── <module>/
│   │   │       ├── <module>.repository.ts  # DB queries
│   │   │       ├── <module>.service.ts     # Business logic
│   │   │       ├── <module>.routes.ts      # Express routes
│   │   │       ├── <module>.types.ts       # Types & Zod schemas
│   │   │       └── index.ts                # Module factory
│   │   ├── shared/              # Shared errors, response helpers, types
│   │   ├── app.ts               # Express app factory
│   │   └── server.ts            # Entry point (migrations + seed + listen)
│   ├── tests/
│   │   ├── setup.ts                # Global test setup: migrations + seed user
│   │   ├── unit/                   # Vitest unit tests (in-memory SQLite)
│   │   └── contract/               # Supertest API contract tests
│   └── vitest.config.ts
│
├── frontend/                    # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/             # NetWorthLine, AssetGroupedBar, SparklineBar, AllocationDonut
│   │   │   ├── layout/             # Sidebar, Header (notification badge)
│   │   │   └── shared/             # StatusPill, EmptyState, VNDInput
│   │   ├── lib/
│   │   │   ├── api.ts              # Typed fetch wrapper with auto token-refresh
│   │   │   ├── auth.tsx            # AuthContext + useAuth hook
│   │   │   └── vnd.ts              # VND formatting: formatVND, abbreviateVND (M/B/T)
│   │   └── pages/
│   │       ├── Dashboard.tsx
│   │       ├── Ledger.tsx
│   │       ├── Savings.tsx
│   │       ├── Loans.tsx
│   │       ├── Metals.tsx
│   │       ├── InvestmentLedger.tsx
│   │       ├── Calendar.tsx
│   │       ├── Analytics.tsx
│   │       └── Settings.tsx
│   └── tests/
│       ├── unit/                   # Vitest component tests
│       └── e2e/                    # Playwright E2E tests
│
└── packages/types/                 # Shared TypeScript interfaces
```

---

## Design Conventions

- **VND formatting**: `formatVND()` for full numbers, `abbreviateVND()` for M/B/T shorthand
- **Negative amounts**: Red with minus prefix; positive in brand-green
- **Soft delete**: Ledger entries have `deleted_at`; never hard-removed
- **FIFO**: Investment sells use first-in-first-out lot matching via pure `fifoMatch()` function
- **Snapshots**: Net worth snapshots upserted on every asset mutation for accurate analytics
- **Viewport**: Designed for ≥ 1280px; smaller viewports show a warning banner

---

## Troubleshooting

**Port already in use**
```bash
lsof -ti:5000 | xargs kill
lsof -ti:3000 | xargs kill
```

**"Cannot open database because the directory does not exist"**
```bash
mkdir -p backend/data backend/uploads/avatars
```

**`better-sqlite3` build failure (Node.js 24+)**

Upgrade to the latest version:
```bash
cd courtify
pnpm add better-sqlite3@latest --filter @courtify/backend
```

**Tests fail with "no such table"**

Delete stale test DB and re-run:
```bash
rm -f courtify/backend/data/test.db
cd courtify && pnpm test
```

**Docker: frontend can't reach backend**

Ensure `VITE_API_URL` in your `.env` points to the correct backend host. For local Docker, use `http://localhost:5000`. For remote deployments, update to the backend's public URL.
