# API Contract Index: COURTIFY REST API

**Base URL**: `http://localhost:5000/api/v1`
**Version**: v1
**Date**: 2026-05-14

---

## Global Conventions

All responses follow this envelope:
```json
{ "data": <payload>, "error": null, "meta": { "count": <int> } }
```
On error:
```json
{ "data": null, "error": { "code": "<string>", "message": "<string>" }, "meta": {} }
```

- Monetary amounts are **strings** (e.g. `"2450000.0000"`) — 4 decimal places, never floats.
- Timestamps are ISO 8601 UTC strings (e.g. `"2026-05-14T07:00:00.000Z"`).
- Dates are `YYYY-MM-DD` strings.
- Booleans are `true`/`false` in JSON responses; stored as `0`/`1` in SQLite.
- Server-side pagination: `?page=1&limit=50`; `meta.count` = total row count.
- Sorting: `?sort=<column>&order=asc|desc`.
- **Auth**: All endpoints except `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/totp/verify`, and `/api/v1/auth/2fa/recovery` require a valid JWT in httpOnly cookie. Returns `401 UNAUTHORIZED` if missing or expired.

---

## Error Codes

| HTTP Status | `error.code` | Meaning |
|-------------|--------------|---------|
| 400 | `VALIDATION_ERROR` | Missing or invalid request body / query param (Zod parse failure) |
| 401 | `UNAUTHORIZED` | Missing, expired, or invalid JWT |
| 403 | `FORBIDDEN` | Valid JWT but insufficient permissions |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Referential integrity violation (e.g. delete of referenced institution) |
| 422 | `BUSINESS_RULE` | Domain rule violation (overpayment, sell volume exceeded, maturity before start) |
| 423 | `ACCOUNT_LOCKED` | 5 consecutive failed login attempts — locked for 15 minutes |
| 500 | `INTERNAL_ERROR` | Unexpected server error (stack trace logged server-side only) |

---

## Contract Files

| Domain | File | Endpoints |
|--------|------|-----------|
| Authentication & Profile | [auth.md](auth.md) | `POST /auth/login`, `/auth/logout`, `/auth/totp/verify`, `/auth/2fa/*`, `GET /auth/me`, `PUT /auth/profile`, `PUT /auth/password` |
| Dashboard | [dashboard.md](dashboard.md) | `GET /dashboard` |
| General Ledger | *(in this file — see below)* | `GET/POST/PUT/DELETE /ledger`, `POST /ledger/:id/attachment` |
| Savings Instruments | [savings.md](savings.md) | `GET/POST/PUT/DELETE /savings` |
| Metals Holdings | *(in this file — see below)* | `GET/POST/PUT/DELETE /metals` |
| Loan & Debt | [loans.md](loans.md) | `GET/POST/PUT/DELETE /loans`, `GET/POST/PUT /loans/:id/payments` |
| Investment Ledger | [investment-ledger.md](investment-ledger.md) | `GET/POST /lots`, `POST /lots/sell`, `PATCH /lots/:id/price`, `GET /lots/:id/transactions`, `GET /transactions/history` |
| Calendar | [calendar.md](calendar.md) | `GET/POST/PUT/DELETE /calendar` |
| Analytics | [analytics.md](analytics.md) | `GET /analytics/net-worth`, `/analytics/performance`, `/analytics/pnl` |
| Settings & Institutions | [settings.md](settings.md) | `GET/POST/PUT/DELETE /institutions`, `GET/PUT /settings` |

---

## General Ledger

### `GET /api/v1/ledger`

**Query params**: `asset_class`, `entry_type`, `status`, `date_from`, `date_to`, `sort`, `order`, `cursor` (opaque pagination cursor), `limit` (default 50)

**Response `data`**: Array of ledger entry objects with `asset_class`, `institution`, all six display columns. Excludes soft-deleted rows (`deleted_at IS NOT NULL`).

**Meta**: `{ "count": <total matching rows>, "next_cursor": "<string | null>" }`

---

### `POST /api/v1/ledger`

**Request body**: `{ asset_class_id, institution_id?, entry_type, description, amount, status?, transaction_date, notes? }`

Triggers `net_worth_snapshots` upsert. **HTTP 201**.

---

### `PUT /api/v1/ledger/:id`

Update any field. Triggers `net_worth_snapshots` upsert.

---

### `DELETE /api/v1/ledger/:id`

**Soft-delete** — sets `deleted_at = datetime('now')`. The row is retained in the database for audit. Triggers `net_worth_snapshots` upsert.

**Response `data`**: `{ "id": <n>, "deleted_at": "<timestamp>" }`

---

### `POST /api/v1/ledger/:id/attachment`

Multipart upload (field: `file`). File stored under `/app/uploads/ledger/`.

**Response `data`**: `{ "attachment_path": "/uploads/ledger/42-receipt.jpg" }`

---

## Metals Holdings

### `GET /api/v1/metals`

**Response `data`**: Array with computed `purchase_value`, `current_value`, `unrealised_gain` strings.

---

### `POST /api/v1/metals`

**Request body**: `{ metal_type, label?, weight_display, weight_unit, purity, purchase_price_per_gram, current_price_per_gram, purchase_date, institution_id? }`

Backend converts `weight_display + weight_unit` → `weight_grams` (canonical gram TEXT). Triggers `net_worth_snapshots` upsert. **HTTP 201**.

**Weight unit conversions**: `chi = × 3.75`, `luong = × 37.5`, `gram = × 1`, `oz = × 31.1035`

---

### `PUT /api/v1/metals/:id`

Update fields. Triggers `net_worth_snapshots` upsert.

---

### `DELETE /api/v1/metals/:id`

Hard delete (metals holdings have no dependent records). Triggers `net_worth_snapshots` upsert.

**Response `data`**: `{ "id": <n> }`
