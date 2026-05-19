# Project Context — Courtify Personal Finance Dashboard

> **Dành cho AI agents và developers.** Đây là tài liệu tổng hợp bối cảnh dự án, các quyết định thiết kế đã được xác nhận, lưu ý kỹ thuật, và quy trình phát triển. Đọc trước khi code bất kỳ thứ gì.

---

## 1. Tổng quan dự án

Ứng dụng quản lý tài chính cá nhân dành cho nhà đầu tư Việt Nam. Theo dõi:
- **Đầu tư**: Cổ phiếu, crypto, quỹ, ETF (mua theo lô, bán FIFO)
- **Kim loại quý**: Vàng, bạc (theo trọng lượng chi/lượng/gram)
- **Bất động sản**: Mua/định giá/thu nhập thuê
- **Tiết kiệm**: Sổ tiết kiệm, kỳ hạn, lãi suất
- **Vay/cho vay**: Theo dõi dư nợ, lịch trả
- **Sổ cái tổng hợp**: Tất cả giao dịch đổ về một ledger chung

**Stack:**
- Backend: Node.js + Express + TypeScript + SQLite (better-sqlite3) — chạy production trong Docker
- Frontend: React + TypeScript + Vite + TailwindCSS
- Auth: JWT trong httpOnly cookie (không dùng Bearer header)
- Port: Backend `5001`, Frontend `5173`

---

## 2. Tài liệu tham chiếu theo nghiệp vụ

| Khi làm việc với... | Đọc tài liệu này trước |
|---------------------|------------------------|
| Module `ledger` — void/reversal/edit history | `docs/ledger-accounting-model.md` |
| Thiết kế UI bất kỳ màn hình nào | `design/<screen_name>/screen.png` (xem bảng trong CLAUDE.md) |
| API contract / field mapping | `specs/001-courtify-wealth-dashboard/contracts/` |
| Schema DB, migration | `specs/001-courtify-wealth-dashboard/data-model.md` |
| Kế hoạch tổng thể | `specs/001-courtify-wealth-dashboard/plan.md` |

---

## 3. Nghiệp vụ tài chính — Quyết định thiết kế đã xác nhận

### 3.1 Sổ cái (Ledger) — Không bao giờ hard delete

Xem chi tiết: `docs/ledger-accounting-model.md`

**Tóm tắt ngắn:**
- `DELETE` endpoint = soft delete (`deleted_at`), KHÔNG xóa DB
- Sửa lỗi bút toán dùng: **Void** (hủy) → **Reversal** (đảo ngược) → **Edit + version history**
- Status `voided` có `voided_at IS NOT NULL` — khi filter theo `status=voided`, phải bỏ điều kiện `voided_at IS NULL` (xem `isTerminalStatusFilter` trong `ledger.service.ts`)
- Status `reversed` = bút toán gốc đã bị đảo ngược, vẫn tồn tại để audit

### 3.2 Lô đầu tư (Asset Lots) — Không xóa, không sửa giá mua

- **Không có `DELETE /:id`** — đúng nghiệp vụ. Lot đại diện giao dịch thực.
- **Không có `PUT /:id` full update** — không được sửa `buy_price_per_unit` hay `original_volume` sau khi mua.
- **Chỉ cho phép `PATCH /:id/price`** — cập nhật giá thị trường hiện tại.
- Muốn "hủy" lot nhập nhầm: bán hết qua `POST /lots/sell` → tạo ledger entry đối ứng.
- Bán theo **FIFO tự động** — `fifoMatch()` phân bổ qua các lô cũ nhất trước.

### 3.3 Tiết kiệm, Vay/Cho vay, Kim loại — Cho phép PUT /:id

Đây là **dữ liệu cấu hình** (lãi suất, hạn mức, nhãn...) chứ không phải giao dịch kế toán bất biến. `PUT /:id` là hợp lệ.

### 3.4 Route ordering — Static trước Dynamic

Express match route theo thứ tự khai báo. **Luôn khai báo route tĩnh TRƯỚC route có tham số:**

```
✅ Đúng:
router.get('/history', ...)   // khai báo trước
router.get('/:id', ...)       // khai báo sau

❌ Sai:
router.get('/:id', ...)       // "history" sẽ bị match vào đây
router.get('/history', ...)   // KHÔNG BAO GIỜ được gọi
```

Đã từng xảy ra: `GET /lots/history` bị nhầm thành `GET /lots/:id` với `id="history"`.

### 3.5 REST API — Chuẩn nhất quán toàn dự án

Mỗi module phải có đủ:

| Route | Ghi chú |
|-------|---------|
| `GET /` | List, hỗ trợ filter/search/sort/page qua query params |
| `POST /` | Create, trả 201 |
| `GET /:id` | Get by ID — **bắt buộc, đừng bỏ sót** |
| `PUT /:id` | Full update (trừ investment lots) |
| `DELETE /:id` | Soft delete hoặc nghiệp vụ phù hợp |

Response envelope thống nhất: `{ data, error, meta }`. Dùng `ok()` và `created()` từ `shared/response.ts`.

---

## 4. Lưu ý kỹ thuật — Những lỗi đã gặp

### 4.1 Docker — Code thay đổi phải rebuild

Backend chạy production build trong Docker. Sau mỗi thay đổi backend:

```bash
cd courtify
docker compose build backend
docker compose up -d backend
```

Không rebuild → server vẫn chạy code cũ → test sai.

### 4.2 Auth — httpOnly Cookie, không phải Bearer

JWT lưu trong httpOnly cookie. Khi test bằng curl:

```bash
# Luôn dùng cookie jar
curl -c cookies.txt -b cookies.txt -X POST .../auth/login -d '{"email":...}'
curl -b cookies.txt .../api/v1/...
```

Không có cookie → 401 cho mọi request. Credentials mặc định trong Docker:
- `INIT_EMAIL=admin@example.com`
- `INIT_PASSWORD=change-me-secure-password`

### 4.3 SQLite — Không drop column

SQLite không hỗ trợ `ALTER TABLE DROP COLUMN` (phiên bản cũ). Migration phải thêm cột mới, không xóa cột cũ.

### 4.4 Ledger filter voided — isTerminalStatusFilter

Khi lọc `status=voided`, SQL cần bỏ điều kiện `voided_at IS NULL` vì hai điều kiện này mâu thuẫn nhau. Đã fix trong `ledger.service.ts` với biến `isTerminalStatusFilter`.

### 4.5 GET /:id — Hay bị bỏ sót khi tạo router mới

Pattern lỗi: tạo router có `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` nhưng **quên `GET /:id`**. Kết quả: 404 HTML thay vì JSON. Kiểm tra kỹ khi tạo module mới.

---

## 5. Cấu trúc thư mục quan trọng

```
courtify/
├── backend/src/
│   ├── modules/             # Mỗi domain: *.service.ts, *.repository.ts, *.routes.ts, *.types.ts
│   ├── infrastructure/
│   │   ├── db/migrations/   # Migration files — đánh số thứ tự 001_, 002_...
│   │   └── middleware/      # auth, asyncHandler, validateBody
│   └── shared/
│       ├── response.ts      # ok(), created() helpers
│       └── errors.ts        # NotFoundError, BusinessRuleError
├── frontend/src/
│   ├── pages/               # Màn hình chính
│   ├── components/shared/   # StatusPill, Modal...
│   └── locales/             # en.json, vi.json — thêm key mới cho cả 2 file
└── design/                  # Screenshots thiết kế — đọc trước khi code UI
```

---

## 6. Quy trình phát triển (Developer Workflow)

```
┌─────────────────────────────────────────────────────────────┐
│  1. PHÂN TÍCH YÊU CẦU                                       │
│     - Đọc design screenshot liên quan (CLAUDE.md → design/) │
│     - Đọc API contract liên quan (specs/.../contracts/)     │
│     - Đọc tài liệu nghiệp vụ nếu chạm vào ledger/lots      │
│     - Nếu có điểm chưa rõ → HỎI TRƯỚC, đừng giả định      │
└────────────────────┬────────────────────────────────────────┘
                     │ đủ thông tin
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. VIẾT CODE                                               │
│     - Backend thay đổi → rebuild Docker                    │
│     - Thêm key i18n → cập nhật cả en.json lẫn vi.json     │
│     - Route mới → kiểm tra static/dynamic ordering        │
│     - Module mới → đảm bảo có đủ GET /:id                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. CHẠY TEST                                               │
│     - Dùng curl với cookie jar (không dùng Bearer)         │
│     - Test các case: list, get by id, create, update,      │
│       delete, filter, search, edge cases                   │
│     - Test UI: mở browser, thao tác golden path + edge     │
└────────────────────┬────────────────────────────────────────┘
                     │
              ┌──────┴──────┐
              │             │
           ✅ Pass       ❌ Fail
              │             │
              │             ▼
              │   ┌─────────────────────────────────────────┐
              │   │  4. ĐỌC LOGS → PHÂN TÍCH               │
              │   │     - docker logs courtify-backend-1    │
              │   │     - Đọc error message kỹ              │
              │   │     - Tìm root cause, KHÔNG workaround  │
              │   │     - Quay lại bước 2 với hiểu biết mới │
              │   └─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. CẬP NHẬT TÀI LIỆU                                      │
│     - Nghiệp vụ mới → cập nhật docs/ tương ứng            │
│     - Lỗi mới gặp → thêm vào mục "Lưu ý kỹ thuật" ở đây  │
│     - Quyết định thiết kế mới → ghi vào đây               │
└─────────────────────────────────────────────────────────────┘
```

### Checklist trước khi báo "Done"

- [ ] Backend đã rebuild Docker nếu có thay đổi
- [ ] `GET /:id` có trong router mới
- [ ] Static routes trước dynamic routes trong cùng một router
- [ ] i18n key cập nhật cả `en.json` lẫn `vi.json`
- [ ] Test curl các case chính thành công
- [ ] Không có TypeScript error mới (pre-existing errors OK nếu không liên quan)
- [ ] Tài liệu cập nhật nếu có thay đổi nghiệp vụ

---

## 7. Modules hiện tại và trạng thái

| Module | Endpoint prefix | GET /:id | Ghi chú |
|--------|----------------|----------|---------|
| Auth | `/api/v1/auth` | — | Login/logout/me |
| Dashboard | `/api/v1/dashboard` | — | Snapshot tổng hợp |
| Ledger | `/api/v1/ledger` | ✅ | Void, reversal, versions |
| Investment (Lots) | `/api/v1/lots` | ✅ | FIFO sell, no DELETE, no PUT |
| Metals | `/api/v1/metals` | ✅ | Vàng/bạc theo gram |
| Savings | `/api/v1/savings` | ✅ | Tiết kiệm có kỳ hạn |
| Loans | `/api/v1/loans` | ✅ | Vay/cho vay + payments |
| Real Estate | `/api/v1/real-estate` | ✅ | BDS + appraisal |
| Calendar | `/api/v1/calendar` | ✅ | Sự kiện đầu tư |
| Analytics | `/api/v1/analytics` | — | Sub-routes: /net-worth, /performance, /pnl, /projection |
| Settings | `/api/v1/settings` | — | App config |
| Institutions | `/api/v1/institutions` | ✅ | Ngân hàng/sàn |
