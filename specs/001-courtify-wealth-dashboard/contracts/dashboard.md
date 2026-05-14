# Contract: Dashboard

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 Requires JWT cookie on all endpoints.

---

## Conventions

See [api.md](api.md) for response envelope, monetary format, and error codes.

---

## Endpoints

### `GET /api/v1/dashboard`

Returns all data needed to render the Dashboard in a single request (net worth hero, four asset cards with sparklines, allocation donut, five most recent ledger entries).

**Response `data`**:
```json
{
  "net_worth": {
    "total_vnd": "2450000000.0000",
    "change_pct": 12.5,
    "previous_total_vnd": "2177777777.0000"
  },
  "asset_cards": [
    {
      "code": "metals",
      "label": "Metals",
      "total_vnd": "450000000.0000",
      "change_pct": 2.4,
      "sparkline": [380, 390, 400, 410, 420, 440, 450]
    },
    {
      "code": "markets",
      "label": "Markets",
      "total_vnd": "800000000.0000",
      "change_pct": 18.1,
      "sparkline": [640, 660, 700, 720, 750, 780, 800]
    },
    {
      "code": "liquidity",
      "label": "Liquidity",
      "total_vnd": "200000000.0000",
      "change_pct": 0.5,
      "sparkline": [195, 196, 197, 198, 199, 200, 200]
    },
    {
      "code": "real_estate",
      "label": "Real Estate",
      "total_vnd": "1000000000.0000",
      "change_pct": 8.0,
      "sparkline": [900, 920, 940, 950, 960, 980, 1000]
    }
  ],
  "allocation": [
    { "code": "real_estate", "label": "Real Estate", "pct": 40.8 },
    { "code": "markets",     "label": "Markets",     "pct": 32.6 },
    { "code": "metals",      "label": "Metals",      "pct": 18.4 },
    { "code": "liquidity",   "label": "Liquidity",   "pct": 8.2  }
  ],
  "recent_ledger": [
    {
      "id": 42,
      "entry_type": "crypto_purchase",
      "description": "BTC via Binance",
      "transaction_date": "2026-05-12T14:30:00.000Z",
      "amount": "-95000000.0000",
      "status": "completed"
    }
  ]
}
```

**Business rules**:
- `allocation` percentages MUST sum to exactly 100% (asset classes with 0 value are excluded).
- `sparkline` arrays contain exactly 7 values (last 7 daily net_worth_snapshots per class); padded with 0 if fewer snapshots exist.
- `recent_ledger` contains exactly 5 most recent non-deleted entries, ordered by `transaction_date DESC`.
- `change_pct` for net worth = `(total_vnd − previous_total_vnd) / previous_total_vnd × 100`; `null` if no prior snapshot exists.
- Negative `change_pct` values display in red on the frontend.
