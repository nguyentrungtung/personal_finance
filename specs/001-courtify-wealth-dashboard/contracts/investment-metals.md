# Contract: Investment Ledger — Gold & Silver (Metals)

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 All endpoints require `access_token` httpOnly cookie.

> Core lot endpoints (GET /lots, POST /lots, POST /lots/sell, PATCH /lots/:id/price):
> see [investment-lots.md](investment-lots.md). This file documents metals-specific fields,
> weight conversion rules, and examples.

---

## Metals-Specific Fields

Lots with `asset_class = metals` carry additional fields absent on other subtypes.
Non-metals lots return these as `null`.

| Field | Type | Description |
|-------|------|-------------|
| `purity` | TEXT | e.g. `"99.99"` — percentage, 2 decimal places; range `(0, 100]` |
| `weight_unit_display` | string | User-chosen input unit: `"chỉ"`, `"lượng"`, or `"gram"` |
| `weight_display` | TEXT | Weight in display unit, e.g. `"10.0000"` (10 chỉ) |
| `weight_grams` | TEXT | **Canonical storage** — always in grams; computed on write |

### Weight Conversion Constants

| Display unit | Grams |
|-------------|-------|
| 1 chỉ | 3.75 g |
| 1 lượng | 37.5 g |
| 1 gram | 1.0 g |

`weight_grams = weight_display × conversion_factor` — computed server-side on every
BUY write; never sent by client.

---

## GET /api/v1/lots — Metals Examples

**Lot view — 2 SJC Gold Bar lots (FR-036: each lot is a separate row)**:
```json
[
  {
    "id": 5,
    "asset_class": "metals",
    "asset_name": "SJC Gold Bar",
    "asset_subtype": "gold",
    "institution": { "id": 3, "name": "SJC" },
    "purchase_date": "2025-11-10",
    "original_volume": "10.0000",
    "remaining_volume": "10.0000",
    "buy_price_per_unit": "8500000.0000",
    "current_price_per_unit": "9200000.0000",
    "current_value": "92000000.0000",
    "unrealised_pnl": "7000000.0000",
    "pct_change": "8.24",
    "status": "active",
    "unit_label": "chỉ",
    "purity": "99.99",
    "weight_unit_display": "chỉ",
    "weight_display": "10.0000",
    "weight_grams": "37.5000",
    "area_m2": null,
    "notes": null
  },
  {
    "id": 6,
    "asset_class": "metals",
    "asset_name": "SJC Gold Bar",
    "asset_subtype": "gold",
    "institution": { "id": 3, "name": "SJC" },
    "purchase_date": "2026-02-20",
    "original_volume": "5.0000",
    "remaining_volume": "5.0000",
    "buy_price_per_unit": "8800000.0000",
    "current_price_per_unit": "9200000.0000",
    "current_value": "46000000.0000",
    "unrealised_pnl": "2000000.0000",
    "pct_change": "4.55",
    "status": "active",
    "unit_label": "chỉ",
    "purity": "99.99",
    "weight_unit_display": "chỉ",
    "weight_display": "5.0000",
    "weight_grams": "18.7500",
    "area_m2": null,
    "notes": "Tích lũy Q1 2026"
  }
]
```

> Toggle Aggregated view to collapse both SJC lots into one row with weighted avg cost.

**Lot view — Silver (lượng)**:
```json
[{
  "id": 7,
  "asset_class": "metals",
  "asset_name": "Silver Bar",
  "asset_subtype": "silver",
  "institution": { "id": 3, "name": "SJC" },
  "purchase_date": "2026-01-05",
  "original_volume": "2.0000",
  "remaining_volume": "2.0000",
  "buy_price_per_unit": "950000.0000",
  "current_price_per_unit": "1050000.0000",
  "current_value": "2100000.0000",
  "unrealised_pnl": "200000.0000",
  "pct_change": "10.53",
  "status": "active",
  "unit_label": "lượng",
  "purity": "99.90",
  "weight_unit_display": "lượng",
  "weight_display": "2.0000",
  "weight_grams": "75.0000",
  "area_m2": null,
  "notes": null
}]
```

**Aggregated view — SJC Gold Bar (2 lots collapsed)**:
```json
[{
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
  "purity": "99.99"
}]
```

---

## POST /api/v1/lots — BUY Request {#buy-request}

**Additional required fields for metals**:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `purity` | TEXT | Yes | `"99.99"` — must be in range `(0, 100]` |
| `weight_unit_display` | string | Yes | `"chỉ"` \| `"lượng"` \| `"gram"` |
| `weight_display` | TEXT | Yes | Weight in the chosen display unit |

`weight_grams` is **never sent by client** — server computes it.

**Request body — Gold, 10 chỉ SJC**:
```json
{
  "asset_class_id": 1,
  "asset_name": "SJC Gold Bar",
  "asset_subtype": "gold",
  "institution_id": 3,
  "purchase_date": "2025-11-10",
  "volume": "10.0000",
  "price_per_unit": "8500000.0000",
  "fee": "0.0000",
  "unit_label": "chỉ",
  "purity": "99.99",
  "weight_unit_display": "chỉ",
  "weight_display": "10.0000",
  "notes": null
}
```
Server stores `weight_grams = 10 × 3.75 = "37.5000"`.

**Request body — Gold, 1 lượng**:
```json
{
  "asset_class_id": 1,
  "asset_name": "PNJ Gold Ring",
  "asset_subtype": "gold",
  "institution_id": 7,
  "purchase_date": "2026-04-01",
  "volume": "1.0000",
  "price_per_unit": "9100000.0000",
  "fee": "0.0000",
  "unit_label": "lượng",
  "purity": "99.00",
  "weight_unit_display": "lượng",
  "weight_display": "1.0000",
  "notes": "PNJ 24k nhẫn trơn"
}
```
Server stores `weight_grams = 1 × 37.5 = "37.5000"`.

**Request body — Gold, raw gram** (e.g. imported bar):
```json
{
  "asset_class_id": 1,
  "asset_name": "DOJI Gold Bar 5g",
  "asset_subtype": "gold",
  "institution_id": 8,
  "purchase_date": "2026-03-10",
  "volume": "5.0000",
  "price_per_unit": "960000.0000",
  "fee": "0.0000",
  "unit_label": "gram",
  "purity": "99.99",
  "weight_unit_display": "gram",
  "weight_display": "5.0000",
  "notes": "DOJI 5g bar"
}
```
Server stores `weight_grams = 5 × 1.0 = "5.0000"`.

---

## POST /api/v1/lots/sell — SELL Example (Gold)

`volume` is expressed in the lot's `unit_label` (e.g. `chỉ`), same as at BUY time.

**Request body**:
```json
{
  "asset_name": "SJC Gold Bar",
  "asset_class": "metals",
  "sell_date": "2026-05-01",
  "volume": "5.0000",
  "price_per_unit": "9200000.0000",
  "fee": "0.0000",
  "notes": "Chốt một phần vàng tích lũy"
}
```

**Response `data`** — FIFO consumes oldest lot first (Lot #5, purchased 2025-11-10):
```json
{
  "total_volume_sold": "5.0000",
  "total_realized_pnl": "3500000.0000",
  "net_cash_received": "46000000.0000",
  "lots_consumed": [
    {
      "lot_id": 5,
      "purchase_date": "2025-11-10",
      "volume_sold": "5.0000",
      "lot_buy_price": "8500000.0000",
      "sell_price": "9200000.0000",
      "realized_pnl": "3500000.0000",
      "lot_status_after": "partial_closed"
    }
  ]
}
```

---

## PATCH /api/v1/lots/:id/price — Price Update (FR-040)

Updating Lot #5's price does **not** change Lot #6's `current_price_per_unit`, even though both
are `SJC Gold Bar`. Each lot is priced independently.

**Request**: `{ "current_price_per_unit": "9500000.0000" }`

**Response `data`**:
```json
{
  "id": 5,
  "asset_name": "SJC Gold Bar",
  "buy_price_per_unit": "8500000.0000",
  "current_price_per_unit": "9500000.0000",
  "remaining_volume": "5.0000",
  "current_value": "47500000.0000",
  "unrealised_pnl": "5000000.0000",
  "pct_change": "11.76"
}
```

---

## Validation Rules (Metals-Specific)

| Rule | Error |
|------|-------|
| `purity` missing when `asset_subtype = gold \| silver` | `400 VALIDATION_ERROR` |
| `purity` ≤ 0 or > 100 | `400 VALIDATION_ERROR` |
| `weight_unit_display` not one of `chỉ \| lượng \| gram` | `400 VALIDATION_ERROR` |
| `weight_display` ≤ 0 | `400 VALIDATION_ERROR` |
| `unit_label` not matching `weight_unit_display` | `400 VALIDATION_ERROR` |

---

## Upgrade Notes (v2+)

- **Live gold price feed**: PATCH /lots/:id/price currently manual. Future: scheduled job
  pulling SJC/DOJI API, batch-updating all active metal lots with same `asset_name`.
- **Weight unit mixing**: Currently each lot stores its own `unit_label`; v2 could normalize
  display to a user-preferred unit across all metals holdings.
- **Purity-adjusted value**: Future: `current_value` weighted by `purity` for cross-metal comparison.
