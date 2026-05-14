# Contract: Settings & Institutions

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 Requires JWT cookie on all endpoints.

---

## Conventions

See [api.md](api.md) for response envelope, monetary format, and error codes.

---

## Institutions

### `GET /api/v1/institutions`

List all non-archived institutions (used to populate dropdowns app-wide).

**Response `data`**:
```json
[{ "id": 1, "name": "Techcombank", "type": "bank" },
 { "id": 2, "name": "SSI",         "type": "broker" }]
```

**Institution types**: `bank | broker | exchange | other`

---

### `POST /api/v1/institutions`

Create a new institution.

**Request body**: `{ "name": "VP Bank – Investment", "type": "bank" }`

**Validation**: `name` must be unique → `409 CONFLICT` if duplicate.

**HTTP 201 Created**. The new institution is immediately available in all entry form dropdowns.

---

### `PUT /api/v1/institutions/:id`

Update institution name or type.

**Request body**: `{ "name": "VP Bank", "type": "broker" }`

---

### `DELETE /api/v1/institutions/:id`

Soft-archive an institution (sets `archived_at` timestamp). **Hard deletion is blocked** if any records reference this institution.

**Business rules**:
- If referenced by `ledger_entries`, `savings_instruments`, `metals_holdings`, or `asset_lots` → set `archived_at = datetime('now')` (soft-archive). Institution is **hidden from all dropdowns** for new entries but existing records retain the reference and display `"(Archived)"`.
- If not referenced by anything → hard delete (remove row entirely).

**Response `data`**: `{ "id": <n>, "archived": true }` (soft) or `{ "id": <n>, "deleted": true }` (hard).

---

## App Settings

### `GET /api/v1/settings`

Retrieve application settings (single row, always exists).

**Response `data`**:
```json
{
  "currency": "VND",
  "notification_days_advance": [1, 7],
  "timezone": "Asia/Ho_Chi_Minh"
}
```

`notification_days_advance`: array of integers from `[1, 3, 7, 30]`. Determines how many days in advance a calendar event triggers a notification indicator in the Topbar.

---

### `PUT /api/v1/settings`

Partial update. Only provided fields are updated.

**Request body**: `{ "notification_days_advance": [1, 3, 7, 30] }`

**Validation**: `notification_days_advance` elements must each be one of `[1, 3, 7, 30]` → `400 VALIDATION_ERROR` otherwise.

**Response `data`**: Updated settings object (same shape as GET).
