# Contract: Investment Ledger — Core Lot Operations

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 Requires `access_token` httpOnly cookie on all endpoints.

> Asset-class-specific fields and examples: see
> [investment-metals.md](investment-metals.md),
> [investment-funds.md](investment-funds.md),
> [investment-real-estate.md](investment-real-estate.md).
> Trade history: see [investment-history.md](investment-history.md).

---

## Conventions

See [api.md](api.md) for response envelope and monetary format.

Monetary values are **TEXT strings** (e.g. `"100000.0000"`). `volume` fields are also TEXT
strings. Never parse these as JavaScript `Number` in frontend JSX.

### Standard Error Codes

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Request body / query params fail Zod schema |
| `UNAUTHORIZED` | 401 | Missing or expired `access_token` |
| `NOT_FOUND` | 404 | Lot ID does not exist |
| `BUSINESS_RULE` | 422 | Domain violation (insufficient volume, closed lot, etc.) |
| `INTERNAL_ERROR` | 500 | Unhandled server error — never exposes stack trace or SQL |

### Asset Subtypes by Tab

| UI Tab | `asset_class` | `asset_subtype` values |
|--------|--------------|----------------------|
| Gold/Silver | `metals` | `gold`, `silver` |
| Stocks/Crypto | `markets` | `stock`, `crypto` |
| Savings/Funds | `liquidity` | `mutual_fund`, `etf`, `bond_fund` |
| Real Estate | `real_estate` | `land`, `apartment`, `commercial` |

### Lot Status Values

| Status | Meaning |
|--------|---------|
| `active` | Original volume fully intact |
| `partial_closed` | Some volume consumed by SELL(s) |
| `closed` | `remaining_volume = 0`; fully sold |

---

## `GET /api/v1/lots`

List asset lots. Supports **Lot view** (default, one row per acquisition) and **Aggregated
view** (one row per `asset_name`, active + partial_closed only).

**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `asset_class` | string | — | `metals` \| `markets` \| `liquidity` \| `real_estate` |
| `asset_subtype` | string | — | See subtype table above |
| `status` | string | `active,partial_closed` | Comma-separated; `all` includes closed lots |
| `view` | string | `lot` | `lot` \| `aggregated` (session-only per FR-037) |
| `asset_name` | string | — | Filter by ticker / product name (e.g. `FPT`, `SJC`) |

**Response `data`** — Lot view, Stock example (FPT):
```json
[{
  "id": 1,
  "asset_class": "markets",
  "asset_name": "FPT",
  "asset_subtype": "stock",
  "institution": { "id": 2, "name": "SSI Securities" },
  "purchase_date": "2026-01-15",
  "original_volume": "1000.0000",
  "remaining_volume": "800.0000",
  "buy_price_per_unit": "100000.0000",
  "current_price_per_unit": "120000.0000",
  "current_value": "96000000.0000",
  "unrealised_pnl": "16000000.0000",
  "pct_change": "20.00",
  "status": "partial_closed",
  "unit_label": "shares",
  "purity": null,
  "weight_unit_display": null,
  "weight_display": null,
  "weight_grams": null,
  "area_m2": null,
  "notes": "Q1 accumulation"
}]
```

**Response `data`** — Aggregated view (all asset classes, grouped by `asset_name`, FR-037):
```json
[
  {
    "asset_name": "FPT",
    "asset_subtype": "stock",
    "asset_class": "markets",
    "total_remaining_volume": "1300.0000",
    "unit_label": "shares",
    "weighted_avg_cost": "96923.0769",
    "current_price_per_unit": "120000.0000",
    "total_current_value": "156000000.0000",
    "total_unrealised_pnl": "29800000.0000",
    "blended_pct_change": "23.81",
    "lot_count": 2,
    "total_weight_grams": null,
    "purity": null,
    "area_m2": null
  },
  {
    "asset_name": "SJC Gold Bar",
    "asset_subtype": "gold",
    "asset_class": "metals",
    "total_remaining_volume": "15.0000",
    "unit_label": "chỉ",
    "weighted_avg_cost": "8666666.6667",
    "current_price_per_unit": "9200000.0000",
    "total_current_value": "138000000.0000",
    "total_unrealised_pnl": "9000000.0000",
    "blended_pct_change": "6.98",
    "lot_count": 2,
    "total_weight_grams": "56.2500",
    "purity": "99.99",
    "area_m2": null
  }
]
```

**Computed fields** (server-side, never stored):
- `current_value = remaining_volume × current_price_per_unit`
- `unrealised_pnl = current_value − (remaining_volume × buy_price_per_unit)`
- `pct_change = (current_price_per_unit − buy_price_per_unit) / buy_price_per_unit × 100`
- `weighted_avg_cost = SUM(remaining_volume × buy_price_per_unit) / SUM(remaining_volume)`
- `total_weight_grams`: SUM of `weight_grams` across lots — metals only, else `null`

**Errors**:
- `400 VALIDATION_ERROR` — unknown `asset_class` or `view` value
- `401 UNAUTHORIZED`

---

## `POST /api/v1/lots`

Record a **BUY** — atomically creates one `asset_lots` row + one `asset_transactions` row
(type=`buy`). Triggers `net_worth_snapshots` upsert. **HTTP 201**.

**Common required fields** (all asset classes):

| Field | Type | Notes |
|-------|------|-------|
| `asset_class_id` | integer | FK → asset_classes |
| `asset_name` | string | Ticker / product name |
| `asset_subtype` | string | See subtype table |
| `institution_id` | integer | FK → institutions |
| `purchase_date` | string | YYYY-MM-DD |
| `volume` | TEXT string | Units in `unit_label` |
| `price_per_unit` | TEXT string | VND per unit |
| `fee` | TEXT string | Transaction fee VND; `"0.0000"` if none |
| `unit_label` | string | `shares`, `chỉ`, `lượng`, `gram`, `units`, `m²`, `property` |
| `notes` | string \| null | Optional |

**Additional fields by asset class**: see
[investment-metals.md](investment-metals.md#buy-request),
[investment-funds.md](investment-funds.md#buy-request),
[investment-real-estate.md](investment-real-estate.md#buy-request).

**Request body — Stock (FPT)**:
```json
{
  "asset_class_id": 2,
  "asset_name": "FPT",
  "asset_subtype": "stock",
  "institution_id": 2,
  "purchase_date": "2026-01-15",
  "volume": "1000.0000",
  "price_per_unit": "100000.0000",
  "fee": "50000.0000",
  "unit_label": "shares",
  "notes": "Q1 accumulation"
}
```

**Response `data`**: Created lot object (same shape as GET Lot view item). **HTTP 201**.

**Errors**:
- `400 VALIDATION_ERROR` — missing required field, `volume` ≤ 0, `price_per_unit` ≤ 0
- `400 VALIDATION_ERROR` — metals: `purity` missing / out of range; `weight_unit_display` invalid
- `400 VALIDATION_ERROR` — real estate: `area_m2` missing or ≤ 0
- `400 VALIDATION_ERROR` — `unit_label` not appropriate for `asset_class`
- `401 UNAUTHORIZED`
- `404 NOT_FOUND` — `institution_id` or `asset_class_id` does not exist
- `500 INTERNAL_ERROR` — DB transaction rolled back

---

## `POST /api/v1/lots/sell`

Record a **SELL** — FIFO lot-matching across all `active`/`partial_closed` lots of `asset_name`
within the same `asset_class`.

**FIFO algorithm**: Consumes lots sorted by `purchase_date ASC` (oldest first). One sell order
may spill across multiple lots → one `asset_transactions` row per consumed lot segment.

**Side effects** (single atomic SQLite transaction — Constitution VI):
1. Decrements `remaining_volume` on each consumed lot
2. Sets `status = partial_closed` (partially consumed) or `closed` (`remaining_volume = 0`)
3. Inserts one `asset_transactions` row per lot segment with `realized_pnl`
4. Upserts `net_worth_snapshots`

**Request body — Stock SELL**:
```json
{
  "asset_name": "FPT",
  "asset_class": "markets",
  "sell_date": "2026-06-01",
  "volume": "1500.0000",
  "price_per_unit": "120000.0000",
  "fee": "180000.0000",
  "notes": "Chốt lời một phần"
}
```

**Response `data`** — FIFO spill across 2 lots:
```json
{
  "total_volume_sold": "1500.0000",
  "total_realized_pnl": "29000000.0000",
  "net_cash_received": "179820000.0000",
  "lots_consumed": [
    {
      "lot_id": 1,
      "purchase_date": "2026-01-15",
      "volume_sold": "1000.0000",
      "lot_buy_price": "100000.0000",
      "sell_price": "120000.0000",
      "realized_pnl": "20000000.0000",
      "lot_status_after": "closed"
    },
    {
      "lot_id": 2,
      "purchase_date": "2026-02-10",
      "volume_sold": "500.0000",
      "lot_buy_price": "106000.0000",
      "sell_price": "120000.0000",
      "realized_pnl": "9000000.0000",
      "lot_status_after": "partial_closed"
    }
  ]
}
```

**Computed fields**:
- `realized_pnl per segment = (sell_price − lot_buy_price) × volume_sold`
- `net_cash_received = total_volume_sold × sell_price − fee`

**Errors**:
- `400 VALIDATION_ERROR` — `volume` ≤ 0, `price_per_unit` ≤ 0, missing required field
- `401 UNAUTHORIZED`
- `422 BUSINESS_RULE` — sell `volume` exceeds `SUM(remaining_volume)` across all active lots
- `422 BUSINESS_RULE` — no active/partial_closed lots found for `asset_name` + `asset_class`
- `500 INTERNAL_ERROR` — SQLite transaction rolled back; no partial writes

---

## `PATCH /api/v1/lots/:id/price`

Inline update of current market price for a **specific lot** (FR-040). Does **not** propagate
to other lots of the same `asset_name` — each lot has its own `current_price_per_unit`.
Triggers `net_worth_snapshots` upsert.

**Request body**:
```json
{ "current_price_per_unit": "125000.0000" }
```

**Response `data`**:
```json
{
  "id": 1,
  "asset_name": "FPT",
  "buy_price_per_unit": "100000.0000",
  "current_price_per_unit": "125000.0000",
  "remaining_volume": "800.0000",
  "current_value": "100000000.0000",
  "unrealised_pnl": "20000000.0000",
  "pct_change": "25.00"
}
```

**Errors**:
- `400 VALIDATION_ERROR` — `current_price_per_unit` ≤ 0 or not a valid decimal string
- `401 UNAUTHORIZED`
- `404 NOT_FOUND` — lot `:id` does not exist
- `422 BUSINESS_RULE` — lot `status = closed` (price update on a fully consumed lot is meaningless)
