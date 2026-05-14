# Research: COURTIFY — Wealth Management Dashboard

**Feature**: `001-courtify-wealth-dashboard`
**Date**: 2026-05-14 (amended — PostgreSQL → SQLite)

---

## 1. VND Monetary Precision in SQLite + Node.js

**Decision**: Store all VND amounts as `TEXT` in SQLite (decimal string, e.g. `"2450000.0000"`);
transfer as string in JSON; parse to JS `Number` (64-bit IEEE 754 double) only at calculation
time in the service layer. Round results to 4 decimal places before writing back.

**Rationale**: SQLite has no exact `NUMERIC` type — its REAL affinity is IEEE 754 double, which
can introduce floating-point rounding on large integers. Storing as TEXT is SQLite's recommended
approach for financial values requiring exact representation. The TEXT → parse to Number → compute
→ TEXT round-trip is identical to the previous PostgreSQL approach (JSON string transfer was
already abstracting the DB precision). JS `Number` (64-bit double) provides ~15–17 significant
decimal digits, sufficient for VND values up to ~9 quadrillion without loss.

**Alternatives considered**:
- REAL affinity: same as JS Number but rounding can occur in SQLite storage layer. Rejected.
- INTEGER (store as integer đồng, ×10000 multiplier): avoids float issues but complicates
  interest accrual and weight calculations that need fractional values. Rejected.
- Decimal.js/BigDecimal in JS: adds a dependency; overkill for single-user scale. Rejected.

---

## 2. SQLite Driver — better-sqlite3

**Decision**: Use `better-sqlite3` as the SQLite driver (synchronous API). All SQL lives in
service files — never inline in route handlers.

**Rationale**: `better-sqlite3` is the fastest Node.js SQLite binding. Its synchronous API
(unlike the async `sqlite3` package) simplifies service code — no callback hell, no async/await
wrapping for simple queries. Single-user app with no concurrent writes makes synchronous access
safe. WAL mode handles concurrent reads from the same process (e.g., dashboard + analytics).

**Alternatives considered**:
- `sqlite3` (async, callback-based): more complex; no performance benefit for single-user. Rejected.
- `@prisma/client` with SQLite: ORM, explicitly excluded by project constraints. Rejected.
- `knex` as query builder (only): adds abstraction not needed; using knex only for migrations.
  Rejected for runtime queries.

---

## 3. SQLite WAL Mode

**Decision**: Enable WAL (Write-Ahead Logging) at database open time:
```js
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
```

**Rationale**: WAL allows concurrent reads while a write is in progress — important when
Analytics and Dashboard queries run while a Ledger mutation is being written. `foreign_keys = ON`
enforces referential integrity (SQLite disables it by default). `busy_timeout` prevents
"database is locked" errors under brief write contention.

**Alternatives considered**:
- Default DELETE journal mode: blocks all reads during writes. Rejected.
- WAL2 (SQLite extension): not available in standard builds. Rejected.

---

## 4. Database Migrations — Knex (SQLite dialect)

**Decision**: Use `knex` for migration management with SQLite client. Migration files in
`backend/src/db/migrations/`. Migrations run via `npm run migrate` on container startup via
`knex migrate:latest`.

**Rationale**: Knex's migration system is SQLite-compatible, uses plain JS/SQL, integrates with
`DB_PATH` env variable, and provides `migrate:latest` / `migrate:rollback` commands. It is the
lightest migration tool that works cleanly with `better-sqlite3` and doesn't require a running
DB server.

**Alternatives considered**:
- `node-pg-migrate`: PostgreSQL-only. Rejected.
- Hand-written SQL init script: no version tracking. Rejected.
- Flyway/Liquibase: JVM-based, overkill. Rejected.

---

## 5. Docker Compose — 2 Services (No DB Container)

**Decision**: Docker Compose has exactly 2 services:
- `frontend`: React/Vite dev server (or Nginx for prod), port 3000
- `backend`: Node/Express API, port 5000; SQLite file at `/app/data/courtify.db`

Named volumes:
- `sqlitedata`: mounted at `/app/data/` — persists the `.db` file across container restarts
- `uploads`: mounted at `/app/uploads/` — persists user-uploaded files

**Rationale**: SQLite is an in-process library — no server process or separate container needed.
Eliminates the `db` service, `DATABASE_URL` connection string, connection pooling, and pg startup
health-check complexity. `docker compose up` is simpler and faster.

**Env vars**:
```env
DB_PATH=/app/data/courtify.db
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
UPLOAD_PATH=/app/uploads
VITE_API_URL=http://localhost:5000
```

**Alternatives considered**:
- Keep PostgreSQL: requires 3 services, connection pool, health checks. Rejected per user request.
- MySQL/MariaDB: same complexity as PostgreSQL without benefit. Rejected.

---

## 6. Authentication — JWT + bcryptjs + 2FA TOTP

**Decision**:
- Passwords hashed with `bcryptjs` (cost factor 12)
- Session via JWT stored in `httpOnly; Secure; SameSite=Strict` cookie, 7-day expiry
- 2FA via TOTP (RFC 6238) using `otplib`; QR code generated with `qrcode` library
- Recovery codes: 8 single-use codes generated at 2FA setup, stored as bcrypt hashes
- Account lockout: 5 consecutive failures → 15-minute lock (stored in `users` table)

**Rationale**: JWT in httpOnly cookie prevents XSS token theft. bcryptjs cost 12 is the current
recommended balance of security and performance (~100 ms hash on modern hardware). TOTP (Google
Authenticator compatible) is standard for 2FA without SMS dependency. `otplib` is a well-maintained
RFC 6238 implementation.

**Alternatives considered**:
- Sessions with express-session + SQLite store: heavier, stateful server. Rejected.
- Passport.js: adds abstraction; single auth strategy doesn't warrant the dependency. Rejected.
- FIDO2/WebAuthn: superior security but too complex for v1 single-user. Deferred.

---

## 7. Loan Installment Tracking

**Decision**: Full installment schedule via a `loan_payments` table. Each loan has N payment
records. Remaining balance = `principal − SUM(paid_amount)` where `paid_amount` comes from
payments with `status = 'paid'`. Loan status computed as:
- `settled` if remaining balance ≤ 0
- `overdue` if remaining balance > 0 AND earliest unpaid payment due date < TODAY
- `active` otherwise

**Rationale**: User chose full installment schedule (clarify Q5=A). Storing payments as rows
enables per-installment tracking, history, and flexible partial payments. Status is computed at
query time to stay in sync with actual payment data.

**Alternatives considered**:
- Simple remaining_balance field (user-updated): loses payment history. Rejected per user choice.
- Lump-sum only: does not support installments. Rejected.

---

## 8. Savings Instrument Types

**Decision**: `instrument_type TEXT NOT NULL` column with values:
`savings_account` | `certificate_of_deposit` | `money_market` | `treasury_bond`

**Rationale**: User confirmed 4 types (clarify Q2=A). Stored as enum-like TEXT constraint.
Accrued interest formula applies uniformly across all 4 types:
`principal × (rate/100) × (days_elapsed/365)`.

---

## 9. Net Worth Snapshots for Analytics (SQLite-adapted)

**Decision**: Upsert a `net_worth_snapshots` row on every mutation (ledger, savings, metals).
`INSERT INTO net_worth_snapshots ... ON CONFLICT(snapshot_date) DO UPDATE SET ...` using
SQLite's upsert syntax (supported since SQLite 3.24).

**Rationale**: Same strategy as original PostgreSQL design. SQLite supports `ON CONFLICT DO
UPDATE` (upsert) natively. Pre-aggregated snapshots keep Analytics queries fast (simple SELECT
with date range) without re-aggregating thousands of rows on demand.

---

## 10. VND Formatting — Vietnamese Shorthand (unchanged)

**Decision**: `formatVND(value, opts)` in `frontend/src/utils/formatVND.js`:
- ≥ 1,000,000,000 → `{n}B VND` · ≥ 1,000,000 → `{n}M VND` · < 1,000,000 → full comma format
- Raw inputs formatted on `blur` using `Intl.NumberFormat('vi-VN')`

Unchanged from original design — this is frontend-only and DB-agnostic.

---

## Resolved Clarifications Summary

| Topic | Resolution |
|-------|-----------|
| Database engine | SQLite 3 via `better-sqlite3` (WAL mode) |
| VND storage in SQLite | `TEXT` (decimal string) — same JSON string transfer pattern |
| Migration tool | `knex migrate:latest` (SQLite dialect) |
| Docker Compose | 2 services: frontend + backend; named volume `sqlitedata` |
| Authentication | bcryptjs + JWT (httpOnly cookie) + TOTP 2FA (otplib) |
| Loan tracking | Full installment schedule (`loan_payments` table) |
| Savings types | 4 types: savings_account, certificate_of_deposit, money_market, treasury_bond |
| Metals canonical unit | Gram; chỉ=3.75g, lượng=37.5g (unchanged) |
| Analytics data source | Pre-computed `net_worth_snapshots` (SQLite upsert) |
