export interface SettingsRow {
  id: number;
  notification_days_advance: string | null;
  notification_emails: string | null;
  timezone: string | null;
  currency: string | null;
  asset_subtypes_config: string | null;
  country_code: string | null;
  date_format: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateSettingsDto {
  notification_days_advance?: string;
  notification_emails?: string;
  timezone?: string;
  currency?: string;
  asset_subtypes_config?: string;
  country_code?: string | null;
  date_format?: string;
}

export interface UpdateProfileDto {
  full_name?: string;
  email?: string;
  professional_title?: string;
}
