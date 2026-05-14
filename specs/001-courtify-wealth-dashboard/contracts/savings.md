# Contract: Savings Instruments

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 Requires JWT cookie on all endpoints.

---

## Conventions

See [api.md](api.md) for response envelope, monetary format, and error codes.

---

## Endpoints

### `GET /api/v1/savings`

List all savings instruments. Includes computed `accrued_interest` (calculated at query time, not stored).

**Response `data`**:
```json
[{
  "id": 7,
  "institution": { "id": 1, "name": "Techcombank" },
  "label": "12-month FD",
  "instrument_type": "certificate_of_deposit",
  "principal": "500000000.0000",
  "interest_rate": "7.5000",
  "start_date": "2026-01-01",
  "maturity_date": "2027-01-01",
  "status": "active",
  "accrued_interest": "18493150.6849"
}]
```

**Computed field**:
- `accrued_interest = CAST(principal AS REAL) × (CAST(interest_rate AS REAL) / 100) × (days_elapsed / 365.0)`, rounded to 4 decimal places.
- `days_elapsed = date('now') − start_date`.

**Instrument types** (exhaustive): `savings_account | certificate_of_deposit | money_market | treasury_bond`

---

### `POST /api/v1/savings`

Create a new savings instrument. **Auto-creates** a `calendar_events` row of type `maturity` for the `maturity_date`. Triggers `net_worth_snapshots` upsert.

**Request body**:
```json
{
  "institution_id": 1,
  "label": "12-month FD",
  "instrument_type": "certificate_of_deposit",
  "principal": "500000000",
  "interest_rate": "7.5",
  "start_date": "2026-01-01",
  "maturity_date": "2027-01-01"
}
```

**Validation**: `maturity_date` MUST be after `start_date` → `422 BUSINESS_RULE` if violated.

**HTTP 201 Created**.

---

### `PUT /api/v1/savings/:id`

Update savings instrument. If `maturity_date` changes, the linked calendar maturity event is updated to the new date. Triggers `net_worth_snapshots` upsert.

**Request body**: Any subset of POST fields.

---

### `DELETE /api/v1/savings/:id`

Delete instrument and its linked calendar maturity event. Triggers `net_worth_snapshots` upsert.

**Response `data`**: `{ "id": <n> }`
