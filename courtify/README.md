# COURTIFY — Personal Wealth Management

COURTIFY is a high-precision, dark-mode personal finance and wealth management dashboard designed for elite portfolio tracking. It allows you to manage assets across multiple classes (metals, markets, liquidity, real estate), track loans, and visualize your net worth trend.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

---

## Features

- **Multi-Asset Tracking**: Monitor Gold/Silver (with live valuation), Stocks, Crypto, and Real Estate.
- **Investment Ledger**: Record buys and sells with automated realized/unrealized P&L calculation.
- **Auto Cash-Flow Ledger**: Every domain action (buy metals, open savings, create loan) automatically generates a signed ledger entry.
- **Debt Management**: Track lending and borrowing with payment history and maturity alerts.
- **Analytics**: Visualize net worth trends, asset allocation, and performance summary.
- **Calendar**: Integrated financial calendar for maturity dates and debt due alerts.
- **Multilingual Support**: Fully localized in **English (US)** and **Tiếng Việt**.
- **Dark Mode UI**: Premium, high-contrast interface designed for 1280px+ viewports.

---

## Prerequisites

- **Docker & Docker Compose** — for containerized deployment (recommended)
- **Node.js** >= 20.0.0 + **pnpm** >= 9.0.0 — for local development only

---

## Quick Start (Docker)

### 1. Clone the repository

```bash
git clone <repository-url>
cd courtify
```

### 2. Create environment file

```bash
cat > .env <<'EOF'
# Required
JWT_SECRET=change-me-to-a-strong-random-secret-32-chars-min
INIT_EMAIL=admin@example.com
INIT_PASSWORD=change-me-secure-password

# Optional (defaults shown)
JWT_EXPIRES_IN=15m
VITE_API_URL=http://localhost:5001
EOF
```

> **Important**: Change `JWT_SECRET` and `INIT_PASSWORD` before deploying.

### 3. Build and start

```bash
docker compose up --build
```

On **first boot**, the server automatically:
1. Runs all database migrations
2. Seeds demo data (institutions, ledger entries, metals, savings, loans, net-worth snapshots)
3. Creates the admin user from `INIT_EMAIL` / `INIT_PASSWORD`

Wait for the log line `[server] Listening on port 5000`, then open:

| Service      | URL                          |
|--------------|------------------------------|
| Frontend     | http://localhost:3000        |
| Backend API  | http://localhost:5001/api/v1 |

### 4. Login

Use the credentials you set in `.env`:
- **Email**: value of `INIT_EMAIL`
- **Password**: value of `INIT_PASSWORD`

### Stop / Restart

```bash
# Stop containers (data persists in Docker volumes)
docker compose down

# Stop and wipe all data (fresh start)
docker compose down -v
```

> Data is stored in Docker volumes `courtify_sqlitedata` and `courtify_uploads` and survives normal restarts.

### Skip demo data

To start with an empty database (no demo data, only the admin user), set `INIT_SEED=false` in `.env`:

```bash
INIT_SEED=false
```

---

## Local Development (without Docker)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure backend environment

```bash
cp .env backend/.env
# Edit backend/.env and set DB_PATH, JWT_SECRET, etc.
```

Or create `backend/.env` directly:

```bash
cat > backend/.env <<'EOF'
NODE_ENV=development
DB_PATH=./data/courtify.db
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=7d
UPLOAD_PATH=./uploads
INIT_EMAIL=admin@example.com
INIT_PASSWORD=admin123
EOF
```

### 3. Run migrations

```bash
cd backend && pnpm migrate
```

### 4. Start both services

```bash
pnpm dev
```

The backend auto-seeds demo data on first run (same as Docker). Both services start in parallel:

| Service      | URL                   |
|--------------|-----------------------|
| Frontend     | http://localhost:5173 |
| Backend API  | http://localhost:5000 |

### Re-seed manually

To repopulate demo data at any time (uses `INSERT OR IGNORE`, safe to run multiple times):

```bash
cd backend && pnpm seed
```

---

## Running Tests

```bash
# All tests
pnpm test

# With coverage report
pnpm test:coverage

# Backend only
cd backend && pnpm test
```

---

## Project Structure

```
courtify/
├── frontend/                    # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/          # Shared UI components (Toast, Modal, Sidebar…)
│   │   ├── locales/             # i18n JSON files (en.json, vi.json)
│   │   ├── pages/               # Route-level pages
│   │   └── lib/                 # API client, VND formatter, utilities
│   └── Dockerfile
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
│   ├── data/                    # SQLite database file (gitignored)
│   └── Dockerfile
├── packages/
│   └── types/                   # Shared TypeScript types
├── docker-compose.yml
├── pnpm-workspace.yaml
└── .env                         # Environment variables (gitignored)
```

---

## Key Backend Scripts

All run from the `backend/` directory:

```bash
# Apply all pending migrations
pnpm migrate

# Roll back last migration batch
pnpm migrate:rollback

# Seed / re-seed demo data
pnpm seed

# Start development server (with hot reload)
pnpm dev

# Build for production
pnpm build
```

---

## API Overview

Base URL: `http://localhost:5000/api/v1` (dev) · `http://localhost:5001/api/v1` (Docker)

All endpoints except `/auth/login` and `/health` require an authenticated session cookie.

| Module        | Endpoints |
|---------------|-----------|
| Health        | `GET /health` |
| Auth          | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/2fa/setup` |
| Dashboard     | `GET /dashboard` |
| Ledger        | `GET /ledger`, `POST /ledger`, `PUT /ledger/:id`, `DELETE /ledger/:id` |
| Metals        | `GET /metals`, `POST /metals`, `PUT /metals/:id`, `DELETE /metals/:id` |
| Savings       | `GET /savings`, `POST /savings`, `PUT /savings/:id`, `DELETE /savings/:id` |
| Loans         | `GET /loans`, `POST /loans`, `PUT /loans/:id`, `POST /loans/:id/payments` |
| Investment    | `GET /lots`, `POST /lots`, `POST /lots/sell` |
| Institutions  | `GET /institutions`, `POST /institutions`, `PUT /institutions/:id`, `DELETE /institutions/:id` |
| Calendar      | `GET /calendar`, `POST /calendar`, `PATCH /calendar/:id/dismiss` |
| Analytics     | `GET /analytics/net-worth`, `GET /analytics/performance`, `GET /analytics/projection`, `GET /analytics/pnl` |
| Settings      | `GET /settings`, `PUT /settings` |

---

## Localization

Translation files:
- `frontend/src/locales/en.json` — English
- `frontend/src/locales/vi.json` — Tiếng Việt

Language preference is persisted in `localStorage` under key `courtify_lang`.

---

## License

Distributed under the MIT License.
