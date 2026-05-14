# Contract: Analytics

**Base URL**: `http://localhost:5000/api/v1/analytics`
**Date**: 2026-05-14
**Auth**: 🔒 Requires JWT cookie on all endpoints.

---

## Conventions

See [api.md](api.md) for response envelope, monetary format, and error codes.

---

## Endpoints

### `GET /api/v1/analytics/net-worth`

Net worth trend over time from `net_worth_snapshots`. Optionally includes a 3-month forward projection.

**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | string | `1y` | `3m \| 6m \| 1y \| all` |
| `projection` | bool | `false` | Include trailing linear regression projection (3 months forward) |

**Response `data`**:
```json
{
  "snapshots": [
    { "date": "2026-01-01", "total_vnd": "2100000000.0000",
      "metals_vnd": "400000000.0000", "markets_vnd": "700000000.0000",
      "liquidity_vnd": "180000000.0000", "real_estate_vnd": "820000000.0000" }
  ],
  "projection": [
    { "date": "2026-06-01", "total_vnd": "2520000000.0000" },
    { "date": "2026-07-01", "total_vnd": "2560000000.0000" },
    { "date": "2026-08-01", "total_vnd": "2600000000.0000" }
  ]
}
```

`projection` is `[]` when `projection=false` or omitted. Projection uses trailing linear regression (least-squares slope) on snapshot data within the selected range, extended 3 months forward.

---

### `GET /api/v1/analytics/performance`

Asset class performance comparison per quarter (grouped bar chart data).

**Query params**: `range` (`3m | 6m | 1y | all`)

**Response `data`**:
```json
{
  "periods": ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"],
  "series": [
    { "code": "metals",      "label": "Metals",      "values": ["420000000.0000", "430000000.0000", "440000000.0000", "450000000.0000"] },
    { "code": "markets",     "label": "Markets",     "values": ["650000000.0000", "700000000.0000", "750000000.0000", "800000000.0000"] },
    { "code": "liquidity",   "label": "Liquidity",   "values": ["195000000.0000", "197000000.0000", "198000000.0000", "200000000.0000"] },
    { "code": "real_estate", "label": "Real Estate", "values": ["900000000.0000", "940000000.0000", "970000000.0000", "1000000000.0000"] }
  ]
}
```

Values represent the asset class total at the **end** of each period, sourced from `net_worth_snapshots`.

---

### `GET /api/v1/analytics/pnl`

Realized P&L summary from closed `asset_transactions` (type=`sell`). Powers the Realized P&L section of the Analytics page (FR-042).

**Query params**: `range` (`3m | 6m | 1y | all`), `asset_class`

**Response `data`**:
```json
{
  "total_realized_pnl": "42600000.0000",
  "win_count": 5,
  "loss_count": 1,
  "win_rate": 83.3,
  "by_month": [
    { "month": "2026-05", "realized_pnl": "16000000.0000", "trade_count": 2 },
    { "month": "2026-04", "realized_pnl": "26600000.0000", "trade_count": 4 }
  ]
}
```

`win_count` = number of SELL transactions with `realized_pnl > 0`.
`loss_count` = number of SELL transactions with `realized_pnl < 0`.
`win_rate` = `win_count / (win_count + loss_count) × 100`, rounded to 1 decimal place.
