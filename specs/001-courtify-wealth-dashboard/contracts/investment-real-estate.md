# Contract: Investment Ledger — Real Estate (Bất động sản)

**Base URL**: `http://localhost:5000/api/v1`
**Date**: 2026-05-14
**Auth**: 🔒 All endpoints require `access_token` httpOnly cookie.

> Core lot endpoints: see [investment-lots.md](investment-lots.md).
> This file documents real-estate-specific fields, pricing models, and examples.

---

## Overview

The **Real Estate** tab (`asset_class = real_estate`) tracks property and land holdings as
asset lots. Current market value is updated manually (no live API in v1).

| `asset_subtype` | Vietnamese | Pricing model |
|-----------------|------------|---------------|
| `apartment` | Căn hộ chung cư | `volume = "1.0000"`, `price_per_unit` = tổng giá trị căn |
| `land` | Đất (thổ cư / nông nghiệp) | `volume` = diện tích m², `price_per_unit` = giá/m² |
| `commercial` | Bất động sản thương mại | `volume = "1.0000"`, `price_per_unit` = tổng giá trị |

---

## Real-Estate-Specific Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `area_m2` | TEXT | Recommended | Hiển thị diện tích (m²); không tham gia tính `current_value` |
| `unit_label` | string | Yes | `"property"` cho apartment/commercial; `"m²"` cho land |

All metals fields (`purity`, `weight_*`) are `null` for real estate lots.

### Pricing Model Detail

**Apartment / Commercial** (`unit_label = "property"`):
- `volume = "1.0000"` (one property)
- `price_per_unit` = tổng giá trị toàn bộ căn / mặt bằng (VND)
- `current_value = 1 × current_price_per_unit`
- `area_m2` = metadata hiển thị (m²), không ảnh hưởng tính toán

**Land** (`unit_label = "m²"`):
- `volume` = tổng diện tích (m²)
- `price_per_unit` = giá thị trường mỗi m² (VND/m²)
- `current_value = volume × current_price_per_unit`
- `area_m2` nên bằng `volume` (hoặc bỏ qua)

---

## GET /api/v1/lots — Real Estate Examples

**Lot view — Căn hộ (apartment)**:
```json
[{
  "id": 12,
  "asset_class": "real_estate",
  "asset_name": "Vinhomes Grand Park — S103.05",
  "asset_subtype": "apartment",
  "institution": { "id": 5, "name": "Vinhomes" },
  "purchase_date": "2024-06-15",
  "original_volume": "1.0000",
  "remaining_volume": "1.0000",
  "buy_price_per_unit": "3200000000.0000",
  "current_price_per_unit": "3750000000.0000",
  "current_value": "3750000000.0000",
  "unrealised_pnl": "550000000.0000",
  "pct_change": "17.19",
  "status": "active",
  "unit_label": "property",
  "area_m2": "68.50",
  "purity": null,
  "weight_unit_display": null,
  "weight_display": null,
  "weight_grams": null,
  "notes": "Căn 2PN, tầng 10, block S1. Sổ đỏ đã có."
}]
```

**Lot view — Lô đất (land, giá/m²)**:
```json
[{
  "id": 13,
  "asset_class": "real_estate",
  "asset_name": "Lô đất Bình Dương — BD-4567",
  "asset_subtype": "land",
  "institution": { "id": 6, "name": "Sàn BĐS ABC" },
  "purchase_date": "2023-03-20",
  "original_volume": "120.0000",
  "remaining_volume": "120.0000",
  "buy_price_per_unit": "8500000.0000",
  "current_price_per_unit": "12000000.0000",
  "current_value": "1440000000.0000",
  "unrealised_pnl": "420000000.0000",
  "pct_change": "41.18",
  "status": "active",
  "unit_label": "m²",
  "area_m2": "120.00",
  "purity": null,
  "weight_unit_display": null,
  "weight_display": null,
  "weight_grams": null,
  "notes": "Đất thổ cư, sổ hồng riêng."
}]
```

**Lot view — Mặt bằng thương mại (commercial)**:
```json
[{
  "id": 14,
  "asset_class": "real_estate",
  "asset_name": "Shophouse Masteri Thảo Điền — R1-01",
  "asset_subtype": "commercial",
  "institution": { "id": 11, "name": "Masterise Homes" },
  "purchase_date": "2023-08-10",
  "original_volume": "1.0000",
  "remaining_volume": "1.0000",
  "buy_price_per_unit": "12500000000.0000",
  "current_price_per_unit": "14800000000.0000",
  "current_value": "14800000000.0000",
  "unrealised_pnl": "2300000000.0000",
  "pct_change": "18.40",
  "status": "active",
  "unit_label": "property",
  "area_m2": "95.00",
  "purity": null,
  "weight_unit_display": null,
  "weight_display": null,
  "weight_grams": null,
  "notes": "Shophouse 2 mặt tiền, đang cho thuê 80tr/tháng."
}]
```

---

## POST /api/v1/lots — BUY Request {#buy-request}

**Request body — Căn hộ (apartment)**:
```json
{
  "asset_class_id": 4,
  "asset_name": "Vinhomes Grand Park — S103.05",
  "asset_subtype": "apartment",
  "institution_id": 5,
  "purchase_date": "2024-06-15",
  "volume": "1.0000",
  "price_per_unit": "3200000000.0000",
  "fee": "96000000.0000",
  "unit_label": "property",
  "area_m2": "68.50",
  "notes": "Căn 2PN, tầng 10, block S1. Sổ đỏ đã có."
}
```

**Request body — Lô đất (land, tính giá/m²)**:
```json
{
  "asset_class_id": 4,
  "asset_name": "Lô đất Bình Dương — BD-4567",
  "asset_subtype": "land",
  "institution_id": 6,
  "purchase_date": "2023-03-20",
  "volume": "120.0000",
  "price_per_unit": "8500000.0000",
  "fee": "25500000.0000",
  "unit_label": "m²",
  "area_m2": "120.00",
  "notes": "Đất thổ cư, sổ hồng riêng."
}
```

**Request body — Shophouse thương mại (commercial)**:
```json
{
  "asset_class_id": 4,
  "asset_name": "Shophouse Masteri Thảo Điền — R1-01",
  "asset_subtype": "commercial",
  "institution_id": 11,
  "purchase_date": "2023-08-10",
  "volume": "1.0000",
  "price_per_unit": "12500000000.0000",
  "fee": "375000000.0000",
  "unit_label": "property",
  "area_m2": "95.00",
  "notes": "Shophouse 2 mặt tiền."
}
```

---

## PATCH /api/v1/lots/:id/price — Định giá lại thị trường

Real estate prices are updated periodically (e.g. quarterly appraisal).

**Request**: `{ "current_price_per_unit": "3900000000.0000" }`

**Response `data`** (căn hộ):
```json
{
  "id": 12,
  "asset_name": "Vinhomes Grand Park — S103.05",
  "buy_price_per_unit": "3200000000.0000",
  "current_price_per_unit": "3900000000.0000",
  "remaining_volume": "1.0000",
  "current_value": "3900000000.0000",
  "unrealised_pnl": "700000000.0000",
  "pct_change": "21.88"
}
```

**Response `data`** (land — giá/m² tăng):
```json
{
  "id": 13,
  "asset_name": "Lô đất Bình Dương — BD-4567",
  "buy_price_per_unit": "8500000.0000",
  "current_price_per_unit": "12000000.0000",
  "remaining_volume": "120.0000",
  "current_value": "1440000000.0000",
  "unrealised_pnl": "420000000.0000",
  "pct_change": "41.18"
}
```

---

## SELL — Bán bất động sản (v1)

In v1, full BĐS transactions (including legal costs, transfer tax) are typically complex and
recorded via the **Ledger page** as a financial event. However, the SELL endpoint is available
for net P&L tracking.

**Request body — Bán căn hộ**:
```json
{
  "asset_name": "Vinhomes Grand Park — S103.05",
  "asset_class": "real_estate",
  "sell_date": "2026-08-01",
  "volume": "1.0000",
  "price_per_unit": "3900000000.0000",
  "fee": "117000000.0000",
  "notes": "Bán lại căn hộ — đã thanh toán phí sang tên"
}
```

**Response `data`**:
```json
{
  "total_volume_sold": "1.0000",
  "total_realized_pnl": "700000000.0000",
  "net_cash_received": "3783000000.0000",
  "lots_consumed": [
    {
      "lot_id": 12,
      "purchase_date": "2024-06-15",
      "volume_sold": "1.0000",
      "lot_buy_price": "3200000000.0000",
      "sell_price": "3900000000.0000",
      "realized_pnl": "700000000.0000",
      "lot_status_after": "closed"
    }
  ]
}
```

---

## Validation Rules (Real-Estate-Specific)

| Rule | Error |
|------|-------|
| `unit_label = "property"` but `volume ≠ "1.0000"` | `400 VALIDATION_ERROR` |
| `asset_subtype = apartment\|commercial` and `area_m2` ≤ 0 | `400 VALIDATION_ERROR` |
| `unit_label = "m²"` but `asset_subtype ≠ land` | `400 VALIDATION_ERROR` |
| `price_per_unit` ≤ 0 | `400 VALIDATION_ERROR` |

---

## Upgrade Notes (v2+)

- **Rental income tracking**: Add `transaction_type = "rental_income"` to `asset_transactions`;
  link rental entries to property lot for yield-on-cost calculation.
- **Appraisal history**: Store each price update as a timestamped row in a new
  `lot_price_history` table for property value trend charts.
- **Legal cost breakdown**: Extend `fee` field to a structured object
  `{ transfer_tax, notary_fee, agent_fee }` for accurate after-tax P&L.
- **Partial land sale**: `volume < original_volume` on sell — already supported by FIFO logic
  (e.g. sell 50m² of a 120m² land lot).
