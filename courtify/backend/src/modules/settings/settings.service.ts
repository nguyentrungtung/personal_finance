import type { SettingsRepository } from './settings.repository.js';
import type { UpdateSettingsDto, UpdateProfileDto } from './settings.types.js';

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  getSettings() {
    return this.repo.findOne();
  }

  updateSettings(data: UpdateSettingsDto) {
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];

    if (data.notification_days_advance !== undefined) { sets.push('notification_days_advance = ?'); vals.push(data.notification_days_advance); }
    if (data.notification_emails !== undefined) { sets.push('notification_emails = ?'); vals.push(data.notification_emails); }
    if (data.timezone !== undefined) { sets.push('timezone = ?'); vals.push(data.timezone); }
    if (data.currency !== undefined) { sets.push('currency = ?'); vals.push(data.currency); }
    if (data.asset_subtypes_config !== undefined) { sets.push('asset_subtypes_config = ?'); vals.push(data.asset_subtypes_config); }
    if (data.country_code !== undefined) { sets.push('country_code = ?'); vals.push(data.country_code ?? null); }
    if (data.date_format !== undefined) { sets.push('date_format = ?'); vals.push(data.date_format); }

    if (sets.length > 1) {
      return this.repo.update(sets, vals);
    }
    return this.repo.findOne();
  }

  getProfile(userId: number) {
    return this.repo.getProfile(userId);
  }

  updateProfile(userId: number, data: UpdateProfileDto) {
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];

    if (data.full_name !== undefined) { sets.push('full_name = ?'); vals.push(data.full_name); }
    if (data.email !== undefined) { sets.push('email = ?'); vals.push(data.email); }
    if (data.professional_title !== undefined) { sets.push('professional_title = ?'); vals.push(data.professional_title); }

    if (sets.length > 1) {
      return this.repo.updateProfile(userId, sets, vals);
    }
    return this.repo.getProfile(userId);
  }

  updateAvatar(userId: number, avatarPath: string) {
    this.repo.updateAvatar(userId, avatarPath);
    return { avatar_path: avatarPath };
  }
}
