# Contract: Authentication & Profile

**Base URL**: `http://localhost:5000/api/v1/auth`
**Date**: 2026-05-14

> Endpoints marked 🔒 require a valid `access_token` httpOnly cookie. Unauthenticated requests
> to protected endpoints return `401 UNAUTHORIZED` — the frontend MUST attempt a silent refresh
> via `POST /auth/refresh` before redirecting to `/login`.

---

## Conventions

See [api.md](api.md) for response envelope, monetary format, and error codes.

### Standard Error Codes (all endpoints)

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Request body / query params fail Zod schema |
| `UNAUTHORIZED` | 401 | Missing or expired `access_token`; invalid credentials; stale refresh token |
| `FORBIDDEN` | 403 | Authenticated but not permitted (e.g. TOTP not yet verified for 2FA-required action) |
| `BUSINESS_RULE` | 422 | Domain violation (wrong current password, invalid TOTP code, overpayment, etc.) |
| `ACCOUNT_LOCKED` | 423 | 5 consecutive login failures; locked for 15 minutes |
| `INTERNAL_ERROR` | 500 | Unhandled server error — details logged server-side only, never exposed to client |

### Cookie Behaviour

On successful full authentication, the server sets **two** httpOnly cookies:

| Cookie | Max-Age | Path | Notes |
|--------|---------|------|-------|
| `access_token` | 15 minutes | `/` | Short-lived JWT; verified by auth middleware on every protected request |
| `refresh_token` | 30 days | `/api/v1/auth/refresh` | Long-lived JWT scoped to refresh path only; carries `token_version` to support revocation |

Both cookies: `HttpOnly; SameSite=Strict; Secure` (Secure only in production).

### Silent Refresh Flow

```
Frontend request → 401 (access_token expired)
  → POST /api/v1/auth/refresh (sends refresh_token cookie automatically)
    → 200: new access_token cookie set → retry original request
    → 401: refresh_token expired or revoked → redirect to /login
```

The frontend Axios interceptor handles this transparently — the user never sees an interruption.

---

## Login & Session

### `POST /api/v1/auth/login`

Authenticate with email and password.

**Request body**:
```json
{ "email": "user@example.com", "password": "secret" }
```

**Response `data`** — no 2FA (full session established):
```json
{ "authenticated": true, "requires_totp": false }
```
Sets `access_token` (15m) + `refresh_token` (30d) httpOnly cookies.

**Response `data`** — 2FA enabled (partial session, no cookies yet):
```json
{ "authenticated": false, "requires_totp": true, "totp_token": "<short-lived signed token>" }
```
`totp_token` is a short-lived JWT (5 min) passed to `POST /auth/totp/verify` to complete login.
No session cookies are set at this stage.

**Errors**:
- `401 UNAUTHORIZED` — invalid email or password
- `423 ACCOUNT_LOCKED` — 5 consecutive failures; locked for 15 minutes
- `500 INTERNAL_ERROR` — unexpected server failure

---

### `POST /api/v1/auth/totp/verify`

Complete 2FA login by verifying TOTP code.

**Request body**:
```json
{ "totp_token": "<short-lived token from /login>", "code": "123456" }
```

**Response `data`**:
```json
{ "authenticated": true }
```
Sets `access_token` (15m) + `refresh_token` (30d) httpOnly cookies.

**Errors**:
- `401 UNAUTHORIZED` — invalid or expired `totp_token`
- `422 BUSINESS_RULE` — TOTP code incorrect or expired (30-second window)

---

### `POST /api/v1/auth/refresh`

Exchange a valid `refresh_token` cookie for a new `access_token` cookie. Called automatically
by the frontend 401 interceptor — never called manually by the user.

**Request**: No body. Sends `refresh_token` cookie automatically (scoped to this path).

**Response `data`**:
```json
{ "refreshed": true }
```
Sets a new `access_token` (15m) httpOnly cookie. `refresh_token` is **not** rotated (stateless).

**Errors**:
- `401 UNAUTHORIZED` — `refresh_token` cookie missing, expired, or malformed
- `401 UNAUTHORIZED` — `token_version` in token payload does not match `users.token_version`
  (token was invalidated by a password change — user must log in again)

---

### `POST /api/v1/auth/logout`

Invalidate session by clearing both cookies server-side.

**Request**: No body required.

**Response `data`**:
```json
{ "logged_out": true }
```
Clears `access_token` and `refresh_token` cookies (sets `Max-Age=0`).

---

### `POST /api/v1/auth/2fa/recovery`

Use a one-time recovery code to bypass TOTP and disable 2FA (for lost authenticator device).

**Request body**: `{ "email": "user@example.com", "recovery_code": "ABCD-1234" }`

**Response `data`**:
```json
{ "authenticated": true, "totp_enabled": false }
```
Sets `access_token` + `refresh_token` cookies. Used recovery code is invalidated (bcrypt-compared
and cleared from stored codes).

**Errors**:
- `401 UNAUTHORIZED` — email not found or recovery code does not match any stored code
- `422 BUSINESS_RULE` — account has no 2FA enabled; recovery not applicable

---

## Profile (🔒 Requires JWT)

### `GET /api/v1/auth/me`

Return current authenticated user profile. Never includes `password_hash` or `totp_secret`.

**Response `data`**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "Nguyen Van A",
  "professional_title": "Portfolio Manager",
  "avatar_path": "/uploads/avatars/avatar.jpg",
  "totp_enabled": false,
  "token_version": 3
}
```

**Errors**:
- `401 UNAUTHORIZED` — `access_token` missing or expired (trigger silent refresh)

---

### `PUT /api/v1/auth/profile`

Update profile fields. Avatar upload via `multipart/form-data`.

**Fields**: `full_name` (string), `professional_title` (string), `avatar` (file — stored under
`/app/uploads/avatars/`; previous avatar file is replaced).

**Response `data`**: Updated user profile object (same shape as `GET /me`).

**Errors**:
- `400 VALIDATION_ERROR` — field fails schema (e.g. `full_name` empty)
- `401 UNAUTHORIZED` — not authenticated
- `500 INTERNAL_ERROR` — file write failure

---

## Security (🔒 Requires JWT)

### `PUT /api/v1/auth/password`

Change password. Requires current password for re-verification. Increments `token_version`
on success, invalidating all active refresh tokens (forces re-login on all other sessions).

**Request body**:
```json
{ "current_password": "old-secret", "new_password": "new-secret", "confirm_password": "new-secret" }
```

**Response `data`**:
```json
{ "updated": true }
```

**Errors**:
- `422 BUSINESS_RULE` — `current_password` incorrect
- `422 BUSINESS_RULE` — `new_password` ≠ `confirm_password`
- `422 BUSINESS_RULE` — `new_password` same as `current_password`

> **Side-effect**: After this call, any existing `refresh_token` for this account returns
> `401 UNAUTHORIZED` on `POST /auth/refresh` (token_version mismatch). The user's current
> session is unaffected (new `access_token` issued immediately).

---

### `POST /api/v1/auth/2fa/setup`

Generate TOTP secret and QR code. Call before enabling 2FA. Returns 8 recovery codes **once**
— the client must display them for the user to save before proceeding to `/2fa/enable`.

**Response `data`**:
```json
{
  "secret": "BASE32ENCODEDTOTPSECRET",
  "qr_url": "data:image/png;base64,iVBORw0KGgo...",
  "recovery_codes": [
    "ABCD-1234", "EFGH-5678", "IJKL-9012",
    "MNOP-3456", "QRST-7890", "UVWX-1234",
    "YZAB-5678", "CDEF-9012"
  ]
}
```
Recovery codes are shown in plaintext exactly once. Stored bcrypt-hashed in DB.

**Errors**:
- `403 FORBIDDEN` — 2FA already enabled on this account (must disable first)

---

### `POST /api/v1/auth/2fa/enable`

Confirm TOTP setup by providing a valid 6-digit code from the authenticator app. Activates
2FA. Must be called after `/2fa/setup`.

**Request body**: `{ "code": "123456" }`

**Response `data`**: `{ "totp_enabled": true }`

**Errors**:
- `422 BUSINESS_RULE` — TOTP code invalid or expired
- `403 FORBIDDEN` — `/2fa/setup` was not called first (no pending secret on account)

---

### `POST /api/v1/auth/2fa/disable`

Disable 2FA. Requires current password confirmation.

**Request body**: `{ "password": "current-password" }`

**Response `data`**: `{ "totp_enabled": false }`

**Errors**:
- `422 BUSINESS_RULE` — password incorrect
- `403 FORBIDDEN` — 2FA is not currently enabled
