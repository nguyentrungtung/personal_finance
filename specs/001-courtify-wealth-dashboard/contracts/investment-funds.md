# Contract: Investment Ledger — Savings/Funds (Chứng chỉ quỹ)

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 All endpoints require `access_token` httpOnly cookie.

> Core lot endpoints: see [investment-lots.md](investment-lots.md).
> This file documents fund-specific fields, subtypes, and examples.

---

## Overview

The **Savings/Funds** tab (`asset_class = liquidity`) tracks lot-based positions in:

| `asset_subtype` | Vietnamese | Example |
|-----------------|------------|---------|
| `mutual_fund` | Quỹ mở | DCVFMVN30, MAFEQI |
| `etf` | Quỹ ETF niêm yết | E1VFVN30, FUEVFVND |
| `bond_fund` | Quỹ trái phiếu | SSIBF, BVPF |

> **Distinction from Savings page**: The Savings page (`/savings`) tracks deposit instruments
> (savings accounts, CDs, treasury bonds) with fixed interest rates — see [savings.md](savings.md).
> This tab tracks **traded fund units** with market NAV pricing, FIFO sell, and realized P&L.

---

## Fund-Specific Fields

No additional fields beyond the core lot schema. All metals/real-estate-specific fields
(`purity`, `weight_*`, `area_m2`) are `null` for fund lots.

| Field | Value for funds |
|-------|----------------|
| `unit_label` | `"units"` (chứng chỉ quỹ) |
| `asset_name` | Fund code: `DCVFMVN30`, `E1VFVN30`, `SSIBF` |
| `institution` | Fund management company (Dragon Capital, SSI AM, Bảo Việt Fund) |
| `buy_price_per_unit` | NAV at purchase date (VND/unit) |
| `current_price_per_unit` | Current NAV — updated manually via inline edit |

---

## GET /api/v1/lots — Fund Examples

**Lot view — Quỹ mở DCVFMVN30 (Dragon Capital)**:
```json
[{
  "id": 9,
  "asset_class": "liquidity",
  "asset_name": "DCVFMVN30",
  "asset_subtype": "mutual_fund",
  "institution": { "id": 4, "name": "Dragon Capital" },
  "purchase_date": "2026-03-01",
  "original_volume": "50000.0000",
  "remaining_volume": "50000.0000",
  "buy_price_per_unit": "25000.0000",
  "current_price_per_unit": "27500.0000",
  "current_value": "1375000000.0000",
  "unrealised_pnl": "125000000.0000",
  "pct_change": "10.00",
  "status": "active",
  "unit_label": "units",
  "purity": null,
  "weight_unit_display": null,
  "weight_display": null,
  "weight_grams": null,
  "area_m2": null,
  "notes": "DCVFMVN30 — VN30 index tracker"
}]
```

**Lot view — ETF E1VFVN30 (SSIAM)**:
```json
[{
  "id": 10,
  "asset_class": "liquidity",
  "asset_name": "E1VFVN30",
  "asset_subtype": "etf",
  "institution": { "id": 9, "name": "SSIAM" },
  "purchase_date": "2026-01-20",
  "original_volume": "30000.0000",
  "remaining_volume": "20000.0000",
  "buy_price_per_unit": "15200.0000",
  "current_price_per_unit": "17800.0000",
  "current_value": "356000000.0000",
  "unrealised_pnl": "52000000.0000",
  "pct_change": "17.11",
  "status": "partial_closed",
  "unit_label": "units",
  "purity": null,
  "weight_unit_display": null,
  "weight_display": null,
  "weight_grams": null,
  "area_m2": null,
  "notes": null
}]
```

**Lot view — Quỹ trái phiếu SSIBF**:
```json
[{
  "id": 11,
  "asset_class": "liquidity",
  "asset_name": "SSIBF",
  "asset_subtype": "bond_fund",
  "institution": { "id": 10, "name": "SSI Asset Management" },
  "purchase_date": "2025-09-15",
  "original_volume": "100000.0000",
  "remaining_volume": "100000.0000",
  "buy_price_per_unit": "10500.0000",
  "current_price_per_unit": "11200.0000",
  "current_value": "1120000000.0000",
  "unrealised_pnl": "70000000.0000",
  "pct_change": "6.67",
  "status": "active",
  "unit_label": "units",
  "purity": null,
  "weight_unit_display": null,
  "weight_display": null,
  "weight_grams": null,
  "area_m2": null,
  "notes": "Phân bổ fixed-income 20% danh mục"
}]
```

---

## POST /api/v1/lots — BUY Request {#buy-request}

No additional fields beyond core schema. `unit_label` must be `"units"`.

**Request body — Quỹ mở (DCVFMVN30)**:
```json
{
  "asset_class_id": 3,
  "asset_name": "DCVFMVN30",
  "asset_subtype": "mutual_fund",
  "institution_id": 4,
  "purchase_date": "2026-03-01",
  "volume": "50000.0000",
  "price_per_unit": "25000.0000",
  "fee": "125000.0000",
  "unit_label": "units",
  "notes": "Mua vào đợt thị trường điều chỉnh"
}
```

**Request body — ETF (E1VFVN30)**:
```json
{
  "asset_class_id": 3,
  "asset_name": "E1VFVN30",
  "asset_subtype": "etf",
  "institution_id": 9,
  "purchase_date": "2026-01-20",
  "volume": "30000.0000",
  "price_per_unit": "15200.0000",
  "fee": "45600.0000",
  "unit_label": "units",
  "notes": null
}
```

**Request body — Quỹ trái phiếu (SSIBF)**:
```json
{
  "asset_class_id": 3,
  "asset_name": "SSIBF",
  "asset_subtype": "bond_fund",
  "institution_id": 10,
  "purchase_date": "2025-09-15",
  "volume": "100000.0000",
  "price_per_unit": "10500.0000",
  "fee": "0.0000",
  "unit_label": "units",
  "notes": "Phân bổ fixed-income 20% danh mục"
}
```

---

## POST /api/v1/lots/sell — SELL Example

FIFO applies identically to stocks. `volume` is in `units`.

**Request body — Redeem ETF E1VFVN30**:
```json
{
  "asset_name": "E1VFVN30",
  "asset_class": "liquidity",
  "sell_date": "2026-04-15",
  "volume": "10000.0000",
  "price_per_unit": "17800.0000",
  "fee": "53400.0000",
  "notes": "Rút một phần ETF"
}
```

**Response `data`**:
```json
{
  "total_volume_sold": "10000.0000",
  "total_realized_pnl": "26000000.0000",
  "net_cash_received": "177946600.0000",
  "lots_consumed": [
    {
      "lot_id": 10,
      "purchase_date": "2026-01-20",
      "volume_sold": "10000.0000",
      "lot_buy_price": "15200.0000",
      "sell_price": "17800.0000",
      "realized_pnl": "26000000.0000",
      "lot_status_after": "partial_closed"
    }
  ]
}
```

---

## Dividend / Distribution Handling (v1: manual)

Dividend or distribution income is recorded as a manual `asset_transactions` entry with
`transaction_type = "dividend"`. No auto-calculation in v1.

```json
{
  "lot_id": 9,
  "transaction_type": "dividend",
  "transaction_date": "2026-06-30",
  "volume": "0.0000",
  "price_per_unit": "0.0000",
  "fee": "0.0000",
  "net_amount": "12500000.0000",
  "realized_pnl": null,
  "notes": "DCVFMVN30 Q2 2026 dividend distribution"
}
```

> `realized_pnl` is `null` on dividend records — only non-null on `sell` type transactions.

---

## Upgrade Notes (v2+)

- **Auto NAV update**: Scheduled job pulling NAV from fund management company APIs
  (Dragon Capital, SSIAM public endpoints) — batch PATCH on all active lots of a fund code.
- **Dividend auto-calculation**: Link to fund's distribution history API; auto-create
  `dividend` transactions on ex-dividend date.
- **Quỹ đóng (closed-end fund)**: Same model as ETF; add `asset_subtype = "closed_end_fund"`.
