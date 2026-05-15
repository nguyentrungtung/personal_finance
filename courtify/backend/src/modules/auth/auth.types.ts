export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  professional_title: string | null;
  avatar_path: string | null;
  totp_secret: string | null;
  totp_enabled: number;
  totp_recovery_codes: string;
  failed_login_attempts: number;
  locked_until: string | null;
  token_version: number;
  created_at: string;
  updated_at: string;
}

export interface AppJwtPayload {
  sub: number;
  version: number;
  type: 'access' | 'refresh' | 'totp';
}
