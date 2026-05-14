# Quickstart: COURTIFY — Development Setup

**Feature**: `001-courtify-wealth-dashboard`
**Date**: 2026-05-14 (amended — SQLite replaces PostgreSQL; 2 Docker services)

---

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin) installed and running
- Git

---

## 1. Clone and Configure Environment

```bash
git clone <repo-url>
cd PersonalFinance

cp .env.example .env
```

Edit `.env`:
```env
DB_PATH=/app/data/courtify.db
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
UPLOAD_PATH=/app/uploads
VITE_API_URL=http://localhost:5000
```

---

## 2. Start All Services

```bash
docker compose up --build
```

This will:
1. Build and start the `backend` service — runs Knex migrations on startup, creates SQLite DB at `/app/data/courtify.db`
2. Build and start the `frontend` service — Vite dev server

**Services**:
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api/v1 |
| SQLite file | `/app/data/courtify.db` (inside backend container, persisted via `sqlitedata` volume) |

No separate database container — SQLite runs in-process inside the backend.

---

## 3. Verify Setup

Check backend health:
```bash
curl http://localhost:5000/api/v1/auth/me
# → 401 UNAUTHORIZED (expected — not yet logged in)
```

Open http://localhost:3000 in a desktop browser (≥ 1280px wide).
The Login screen should appear.

---

## 4. First-Time Setup — Create Account

The backend auto-creates the first user account on startup if none exists, using env vars:
```env
INIT_EMAIL=admin@courtify.local
INIT_PASSWORD=changeme123
```

Log in at http://localhost:3000/login with these credentials. Change the password immediately
in Settings → Security → Change Password.

---

## 5. Seed Development Data (Optional)

```bash
docker compose exec backend npm run seed
```

Seeds: 1 user, 5 institutions, 4 asset classes, 20 ledger entries, 3 savings instruments,
5 metals holdings, 3 loans with installments, 12 months of net worth snapshots.

---

## 6. Run Tests

**Backend**:
```bash
docker compose exec backend npm test
docker compose exec backend npm run test:coverage
```

**Frontend**:
```bash
docker compose exec frontend npm test
docker compose exec frontend npm run test:coverage
```

---

## 7. Database Migrations

Migrations run automatically on backend startup. To run manually:
```bash
docker compose exec backend npm run migrate          # knex migrate:latest
docker compose exec backend npm run migrate:rollback # knex migrate:rollback
```

Migration files: `backend/src/db/migrations/`

---

## 8. Accessing the SQLite File Directly

```bash
docker compose exec backend sh -c 'sqlite3 $DB_PATH'
```

Or copy the file to host for inspection:
```bash
docker cp $(docker compose ps -q backend):/app/data/courtify.db ./courtify.db
sqlite3 courtify.db ".tables"
```

---

## 9. Accessing Uploaded Files

Files are served at:
```
http://localhost:5000/uploads/<path>
```

Persisted in named volume `uploads`, mounted at `/app/uploads/` inside backend.

---

## 10. Stopping and Cleaning Up

Stop services (preserves data):
```bash
docker compose down
```

Full reset (deletes SQLite DB and uploads):
```bash
docker compose down -v
```

---

## Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Login fails with correct credentials | Wrong `INIT_PASSWORD` was used | Run `docker compose down -v` then `docker compose up --build` to recreate the initial user |
| `SQLITE_BUSY` error | Another process has the DB open | Ensure only one backend instance is running; WAL mode reduces but doesn't eliminate this |
| API returns `401` on all requests | JWT cookie missing or expired | Log in again at http://localhost:3000/login |
| Layout broken at < 1280px | Expected — desktop only | Use ≥ 1280px browser window |
| `ECONNREFUSED` on API calls | `VITE_API_URL` mismatch | Ensure `.env` has `VITE_API_URL=http://localhost:5000` and rebuild frontend |
