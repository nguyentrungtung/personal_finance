# Contract: Loan & Debt Management

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 Requires JWT cookie on all endpoints.

---

## Conventions

See [api.md](api.md) for response envelope, monetary format, and error codes.

---

## Loans

### `GET /api/v1/loans`

List all loans with computed `remaining_balance` and `status`. Includes summary totals.

**Query params**:

| Param | Default | Description |
|-------|---------|-------------|
| `loan_type` | `all` | `lent \| borrowed \| all` |
| `status` | `all` | `active \| overdue \| settled \| all` |
| `sort` | `expected_due_date` | Column to sort by |
| `order` | `asc` | `asc \| desc` |
| `page` | `1` | Page number |
| `limit` | `50` | Rows per page |

**Response `data`**:
```json
{
  "summary": {
    "total_lent": "42500000.0000",
    "total_borrowed": "15200000.0000",
    "net_balance": "27300000.0000"
  },
  "loans": [{
    "id": 1,
    "loan_type": "lent",
    "counterparty_name": "Le Nam",
    "description": "Business Expansion",
    "principal": "15000000.0000",
    "remaining_balance": "10000000.0000",
    "date_issued": "2023-10-12",
    "expected_due_date": "2024-04-12",
    "repayment_terms": "3 monthly installments of 5,000,000 VND",
    "status": "active",
    "next_payment_due": "2024-01-12"
  }]
}
```

**Computed fields** (server-side):
- `remaining_balance = principal − SUM(paid_amount WHERE loan_payments.status = 'paid')`
- `status`:
  - `settled` — `remaining_balance ≤ 0`
  - `overdue` — `remaining_balance > 0` AND earliest unpaid payment `due_date < date('now')`
  - `active` — otherwise
- `next_payment_due` — earliest `due_date` of a `scheduled` or `overdue` payment; `null` if settled.
- Summary `total_lent` = SUM of principals where `loan_type = 'lent'` and `status ≠ 'settled'`.
- Summary `net_balance = total_lent − total_borrowed`.

---

### `POST /api/v1/loans`

Create a loan with an optional initial installment schedule.

**Request body**:
```json
{
  "loan_type": "lent",
  "counterparty_name": "Le Nam",
  "description": "Business Expansion",
  "principal": "15000000",
  "date_issued": "2023-10-12",
  "expected_due_date": "2024-04-12",
  "repayment_terms": "3 monthly installments",
  "payments": [
    { "scheduled_amount": "5000000", "due_date": "2023-11-12" },
    { "scheduled_amount": "5000000", "due_date": "2023-12-12" },
    { "scheduled_amount": "5000000", "due_date": "2024-01-12" }
  ]
}
```

`payments` is optional — installments can be added later via `POST /loans/:id/payments`.

**HTTP 201 Created**.

---

### `PUT /api/v1/loans/:id`

Update loan header fields (counterparty, description, dates, repayment_terms). Does not affect existing payment records.

---

### `DELETE /api/v1/loans/:id`

Delete a loan and **cascade** delete all its `loan_payments` and any linked `calendar_events` (type=`loan_settled`).

**Response `data`**: `{ "id": <n> }`

---

## Loan Payments

### `GET /api/v1/loans/:id/payments`

List all installment payment records for a loan.

**Response `data`**:
```json
[{
  "id": 1,
  "scheduled_amount": "5000000.0000",
  "due_date": "2023-11-12",
  "paid_amount": "5000000.0000",
  "paid_date": "2023-11-10",
  "status": "paid",
  "notes": null
}]
```

**Payment status values**: `scheduled | paid | overdue`

---

### `POST /api/v1/loans/:id/payments`

Add a new scheduled installment to a loan.

**Request body**: `{ "scheduled_amount": "5000000", "due_date": "2024-01-12", "notes": null }`

**HTTP 201 Created**.

---

### `PUT /api/v1/loans/:loan_id/payments/:payment_id`

Record payment (mark as paid) or update payment details.

**Request body**: `{ "paid_amount": "5000000", "paid_date": "2024-01-10", "status": "paid", "notes": null }`

**Business rules** (enforced at service layer before DB write):
- `paid_amount` MUST NOT exceed the loan's current `remaining_balance` → `422 BUSINESS_RULE` if violated.
- If `remaining_balance` reaches 0 after this payment: loan `status` auto-transitions to `settled`; a `calendar_events` row of type `loan_settled` is **auto-created** for today's date.

**Response `data`**: Updated payment object.
