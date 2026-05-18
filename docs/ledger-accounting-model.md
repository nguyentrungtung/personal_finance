# Mô hình kế toán sổ cái (Ledger Accounting Model)

> Tài liệu này giải thích **tại sao** dữ liệu sổ cái được lưu theo cách này,
> các nghiệp vụ hợp lệ để sửa lỗi, và cách đọc/dùng đúng phần mềm.
> Đây là nguồn sự thật duy nhất cho AI agents và developers khi làm việc với module `ledger`.

---

## 1. Nguyên tắc nền tảng: Không bao giờ xóa bút toán

**Trong kế toán tài chính, một bút toán đã ghi vào sổ cái không bao giờ bị xóa vật lý (hard delete).**

Lý do:
- **Audit trail (vết kiểm toán)**: Mọi thay đổi phải có thể truy ngược lại.
- **Toàn vẹn số dư**: Số dư tại bất kỳ thời điểm nào phải tính được chính xác từ lịch sử.
- **Đối soát**: Khi ngân hàng/sàn giao dịch báo cáo con số X, phần mềm phải tái tạo đúng con số đó.
- **Pháp lý**: Nhiều quy định yêu cầu lưu lịch sử giao dịch tài chính tối thiểu 5–10 năm.

**Trong project này:**
- `DELETE` endpoint → soft delete (`deleted_at`), dữ liệu vẫn trong DB.
- Mọi sửa lỗi nghiệp vụ đều dùng **Void**, **Reversal**, hoặc **Edit with history**.

---

## 2. Ba trạng thái "kết thúc" của bút toán

| Status | Ý nghĩa | Tính vào số dư? |
|--------|---------|-----------------|
| `completed` | Giao dịch đã hoàn tất, xác nhận | ✅ Có |
| `cleared` | Đã đối soát khớp với sao kê ngân hàng | ✅ Có |
| `voided` | Bị hủy — ghi sai, không nên xảy ra | ❌ Không |
| `reversed` | Bị đảo ngược bởi một bút toán đảo | ❌ Không (bù trừ bởi reversal) |

Trạng thái `pending` và `appraisal` là tạm thời, vẫn tính vào số dư theo logic hiển thị của từng màn hình.

---

## 3. Tầng 1 — Void (Hủy bút toán)

### Khi nào dùng?
Khi một bút toán **không hợp lệ hoàn toàn** — ví dụ: nhập trùng, nhập nhầm loại, giao dịch không thực sự xảy ra.

### Cách hoạt động
```
Trước void:
  id=42  BTC purchase  -300,000,000  status=completed

Sau PATCH /api/ledger/42/void  { reason: "Nhập trùng giao dịch ngày 15/5" }:
  id=42  BTC purchase  -300,000,000  status=voided  voided_at=...  void_reason="Nhập trùng..."
```

- Dòng vẫn tồn tại trong DB.
- Hiển thị trên UI với badge **"Đã hủy"** (màu đỏ/xám).
- **Không tính** vào tổng số dư.
- Mặc định bị ẩn khỏi danh sách — dùng filter `include_voided=true` để xem.

### API
```http
PATCH /api/ledger/:id/void
Body: { "reason": "Lý do bắt buộc, tối thiểu 3 ký tự" }
```

### Quy tắc nghiệp vụ
- Bút toán đã void **không thể void lần nữa**.
- Bút toán auto-generated (từ modules metals/savings/loans) **không thể void trực tiếp** — phải sửa ở source module.
- `reason` là **bắt buộc** — không cho phép void không lý do.

---

## 4. Tầng 2 — Reversal (Bút toán đảo ngược)

### Khi nào dùng?
Khi bút toán đã `completed` cần **sửa số tiền hoặc loại giao dịch** — ví dụ: nhập -300tr thay vì -250tr.

Void không đủ vì cần tạo lại bút toán mới đúng. Reversal tạo dấu vết rõ ràng: bút toán gốc → bị đảo ngược → bút toán đúng.

### Cách hoạt động
```
Bút toán gốc (sai):    id=42  BTC purchase  -300,000,000  status=completed

STEP 1 — POST /api/ledger/42/reverse  { reason: "Số tiền sai, cần sửa -250tr" }
  → Tạo bút toán đảo: id=43  [ĐẢO NGƯỢC] BTC purchase  +300,000,000  status=completed  reversal_of=42
  → Cập nhật gốc:    id=42  ...  status=reversed

STEP 2 — POST /api/ledger  (nhập lại đúng)
  → Tạo bút toán mới: id=44  BTC purchase  -250,000,000  status=completed
```

**Ba dòng tồn tại mãi mãi. Net effect = -250,000,000 đúng.**

```
id=42:  -300,000,000  [reversed]   ← bị đảo ngược
id=43:  +300,000,000  [completed]  ← bù trừ hoàn toàn
id=44:  -250,000,000  [completed]  ← số đúng
                     ─────────────
Net:    -250,000,000  ✅
```

### API
```http
POST /api/ledger/:id/reverse
Body: { "reason": "Lý do đảo ngược" }
Response: bút toán đảo ngược vừa được tạo (id=43 trong ví dụ trên)
```

Sau đó client tạo bút toán đúng:
```http
POST /api/ledger
Body: { ...đúng fields... }
```

### Quy tắc nghiệp vụ
- Chỉ áp dụng cho manual entries (`is_auto = 0`).
- Không thể đảo ngược bút toán đã `voided` hoặc đã `reversed`.
- `reversal_of` liên kết bút toán đảo về gốc — dùng để hiển thị "xem chain" trên UI.

---

## 5. Tầng 3 — Edit History (Lịch sử chỉnh sửa)

### Khi nào dùng?
Khi cần **sửa nhỏ** mà không cần đảo ngược — ví dụ: sửa ngày giao dịch, sửa ghi chú, đổi institution.

### Cách hoạt động
Mỗi lần `PUT /api/ledger/:id` được gọi, hệ thống **tự động snapshot** row hiện tại vào bảng `ledger_entry_versions` **trước khi ghi đè**.

```
ledger_entry_versions:
  entry_id=42  version=1  snapshot={...old data...}  edit_reason="Sửa ngày"  changed_at=2026-05-18
  entry_id=42  version=2  snapshot={...data sau lần 1...}  edit_reason=null  changed_at=2026-05-20
```

### API
```http
PUT /api/ledger/:id
Body: { ...fields muốn cập nhật..., "edit_reason": "Lý do (tùy chọn)" }

GET /api/ledger/:id/versions
Response: danh sách snapshot theo thứ tự version tăng dần
```

### Quy tắc nghiệp vụ
- `ledger_entry_versions` là append-only — không bao giờ bị xóa.
- `edit_reason` không bắt buộc nhưng **khuyến nghị** cho bút toán `completed`/`cleared`.
- Snapshot lưu toàn bộ row (JSON) — không phụ thuộc schema thay đổi trong tương lai.

---

## 6. Bảng quyết định: Dùng nghiệp vụ nào?

| Tình huống | Hành động đúng | Hành động sai |
|-----------|---------------|---------------|
| Nhập trùng giao dịch | Void entry cũ | Xóa (delete) |
| Giao dịch không xảy ra | Void | Xóa |
| Nhập sai số tiền (completed) | Reverse + nhập lại đúng | Edit trực tiếp |
| Nhập sai loại giao dịch | Reverse + nhập lại đúng | Edit trực tiếp |
| Sửa ngày/ghi chú nhỏ | PUT với edit_reason | OK nhưng nên ghi reason |
| Đổi institution | PUT với edit_reason | OK |
| Auto entry sai (metals/savings) | Sửa tại source module | Void/reverse ledger trực tiếp |
| Bút toán tự động dư thừa | Liên hệ source module | Void ledger trực tiếp |

---

## 7. Cấu trúc bảng liên quan

### `ledger_entries` (các cột liên quan đến tính toàn vẹn)

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `status` | TEXT | `completed \| pending \| appraisal \| cleared \| voided \| reversed` |
| `deleted_at` | TEXT (ISO8601) | Soft delete timestamp |
| `voided_at` | TEXT (ISO8601) | Void timestamp (migration 021) |
| `void_reason` | TEXT | Lý do void — bắt buộc khi void |
| `reversal_of` | INTEGER (FK) | Trỏ về `id` của entry gốc bị đảo ngược (migration 022) |
| `is_auto` | INTEGER (0/1) | 1 = tạo tự động từ module khác, không được sửa trực tiếp |
| `source_module` | TEXT | Module tạo ra entry (`metals`, `savings`, `loans`, ...) |
| `source_id` | INTEGER | PK của record gốc trong source module |

### `ledger_entry_versions` (migration 022)

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `entry_id` | INTEGER (FK) | Trỏ về `ledger_entries.id` |
| `version` | INTEGER | Số thứ tự, bắt đầu từ 1, tăng dần mỗi lần edit |
| `snapshot` | TEXT (JSON) | Toàn bộ row trước khi edit |
| `edit_reason` | TEXT | Lý do chỉnh sửa (tùy chọn) |
| `changed_at` | TEXT (ISO8601) | Thời điểm chỉnh sửa |

---

## 8. Quy tắc cho số dư (Balance Calculation)

Số dư chỉ tính các entry thỏa:
```sql
WHERE deleted_at IS NULL
  AND voided_at IS NULL
  AND status NOT IN ('voided', 'reversed')
```

Bút toán `reversal_of IS NOT NULL` (tức là bút toán đảo) **vẫn được tính** vào số dư vì đó là giao dịch có giá trị dương/âm bù trừ entry gốc.

---

## 9. Luồng UX khuyến nghị

### Khi user nhấn "Sửa" bút toán `completed`:
```
Modal hỏi:
  "Bút toán này đã hoàn thành.
   ○ Tạo bút toán đảo ngược + nhập lại (khuyến nghị — không mất lịch sử)
   ○ Chỉnh sửa trực tiếp (lịch sử được lưu trong versions)"
```

### Khi user nhấn "Xóa":
```
Thực ra là Void, không phải xóa vật lý.
Hiển thị: "Bút toán sẽ bị hủy (voided). Vui lòng nhập lý do:"
[input lý do]  →  PATCH /:id/void
```

---

## 10. Ví dụ thực tế đầy đủ

### Tình huống: Mua BTC 300tr, thực ra chỉ 250tr

```
Ngày 15/5: Nhập bút toán BTC purchase -300,000,000 [completed]
Ngày 16/5: Phát hiện sai

Bước 1: POST /api/ledger/42/reverse
  Body: { reason: "Số tiền sai: đã mua 250tr không phải 300tr" }
  → Entry 42 thành [reversed]
  → Entry 43 mới: +300,000,000 [ĐẢO NGƯỢC] [completed]

Bước 2: POST /api/ledger
  Body: { ..., amount: "-250000000", description: "BTC purchase", status: "completed" }
  → Entry 44: -250,000,000 [completed]

Kết quả trong sổ cái (sorted by date):
  42: 15/5  BTC purchase           -300,000,000  [reversed]   ← còn đây, không tính
  43: 15/5  [ĐẢO NGƯỢC] BTC purchase +300,000,000 [completed]  ← bù trừ 42
  44: 15/5  BTC purchase           -250,000,000  [completed]  ← số đúng

Số dư ảnh hưởng: -250,000,000 ✅
```

### Tình huống: Nhập trùng giao dịch tiết kiệm

```
Nhập savings_deposit +10,000,000 (id=55) và (id=56) cùng ngày — bị trùng

Bước 1: PATCH /api/ledger/56/void
  Body: { reason: "Nhập trùng, giao dịch thực là id=55" }
  → Entry 56 thành [voided], không tính vào số dư

Số dư ảnh hưởng: chỉ tính +10,000,000 một lần ✅
```

---

## 11. Những điều AI Agents cần nhớ

1. **Không bao giờ đề xuất hard delete** cho bút toán đã tạo.
2. Khi user nói "xóa bút toán" → hỏi rõ lý do, thực hiện **Void**.
3. Khi user nói "sửa số tiền bút toán completed" → đề xuất **Reversal** trước.
4. Khi user nói "sửa ngày/ghi chú" → dùng **PUT** với `edit_reason`.
5. `is_auto=1` entries không được sửa trực tiếp — báo user sửa ở màn hình nguồn.
6. Filter mặc định ẩn `voided` entries — dùng `include_voided=true` để debugging.
7. `reversal_of` giúp UI hiển thị "xem bút toán liên quan" — luôn fetch cả chain khi show detail.
