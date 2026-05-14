# Contract: Financial Calendar

**Base URL**: `http://localhost:5000/api/v1/calendar`
**Date**: 2026-05-14
**Auth**: 🔒 Requires JWT cookie on all endpoints.

---

## Conventions

See [api.md](api.md) for response envelope, monetary format, and error codes.

---

## Endpoints

### `GET /api/v1/calendar`

List all calendar events sorted by `due_date ASC`. Includes computed urgency fields.

**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | date | — | Filter events from this date (YYYY-MM-DD) |
| `to` | date | — | Filter events up to this date |
| `event_type` | string | — | `maturity \| debt_due \| savings_goal \| loan_settled \| other` |
| `include_dismissed` | bool | `false` | Include events with `is_dismissed = true` |

**Response `data`**:
```json
[{
  "id": 12,
  "title": "Techcombank CD Maturity",
  "event_type": "maturity",
  "due_date": "2027-01-01",
  "days_until_due": 231,
  "is_urgent": false,
  "amount": "500000000.0000",
  "asset_class": { "code": "liquidity", "label": "Liquidity" },
  "linked_savings_id": 7,
  "linked_loan_id": null,
  "linked_ledger_id": null,
  "notes": null,
  "is_dismissed": false
}]
```

**Computed fields** (server-side):
- `days_until_due = CAST((julianday(due_date) - julianday('now')) AS INTEGER)` in Asia/Ho_Chi_Minh timezone.
- `is_urgent = days_until_due <= 7` (true even if negative — overdue events).

**Auto-created events** (never manually deleted by user):
- `maturity` — created by `POST /savings` (linked to `savings_instruments`)
- `loan_settled` — created when loan `remaining_balance` reaches 0 (linked to `loans`)

---

### `POST /api/v1/calendar`

Create a manual calendar event.

**Request body**:
```json
{
  "title": "Tax Filing Deadline",
  "event_type": "other",
  "due_date": "2026-03-31",
  "amount": null,
  "asset_class_id": null,
  "notes": "Annual income tax"
}
```

**HTTP 201 Created**.

---

### `PUT /api/v1/calendar/:id`

Update an event. Supports dismissing via `{ "is_dismissed": true }`.

**Request body**: Any subset of POST fields plus `is_dismissed` (bool).

---

### `DELETE /api/v1/calendar/:id`

Delete a manually created event. Auto-created events (maturity, loan_settled) are deleted automatically when their parent record (savings instrument, loan) is deleted.

**Response `data`**: `{ "id": <n> }`
