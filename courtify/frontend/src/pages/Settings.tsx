import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, Plus, X, Mail, Globe, Play, RefreshCw } from 'lucide-react';
import { RegionalWizardModal } from '../components/settings/RegionalWizardModal';
import type { CountryPreset } from '../lib/countryPresets';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { setLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES, type LangCode } from '../lib/i18n';
import { SUPPORTED_CURRENCIES, loadOverrides, saveOverride, clearOverride } from '../lib/currency';
import { useCurrency } from '../lib/currencyContext';

// ─── Common timezones list ────────────────────────────────────────────────────
const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: '🇻🇳 Asia/Ho Chi Minh (UTC+7)' },
  { value: 'Asia/Bangkok', label: '🇹🇭 Asia/Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: '🇸🇬 Asia/Singapore (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: '🇭🇰 Asia/Hong Kong (UTC+8)' },
  { value: 'Asia/Shanghai', label: '🇨🇳 Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo', label: '🇯🇵 Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: '🇰🇷 Asia/Seoul (UTC+9)' },
  { value: 'Asia/Kolkata', label: '🇮🇳 Asia/Kolkata (UTC+5:30)' },
  { value: 'Asia/Dubai', label: '🇦🇪 Asia/Dubai (UTC+4)' },
  { value: 'Europe/London', label: '🇬🇧 Europe/London (UTC+0/+1)' },
  { value: 'Europe/Paris', label: '🇫🇷 Europe/Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin', label: '🇩🇪 Europe/Berlin (UTC+1/+2)' },
  { value: 'America/New_York', label: '🇺🇸 America/New York (UTC-5/-4)' },
  { value: 'America/Chicago', label: '🇺🇸 America/Chicago (UTC-6/-5)' },
  { value: 'America/Los_Angeles', label: '🇺🇸 America/Los Angeles (UTC-8/-7)' },
  { value: 'America/Sao_Paulo', label: '🇧🇷 America/São Paulo (UTC-3)' },
  { value: 'Australia/Sydney', label: '🇦🇺 Australia/Sydney (UTC+10/+11)' },
  { value: 'Pacific/Auckland', label: '🇳🇿 Pacific/Auckland (UTC+12/+13)' },
  { value: 'UTC', label: '🌐 UTC (UTC+0)' },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Institution {
  id: number; name: string; type: string;
  supported_channels?: string; archived_at: string | null;
}
interface Profile {
  id: number; email: string; full_name: string;
  professional_title: string; avatar_path: string | null; totp_enabled?: boolean;
}
interface AppSettings {
  notification_days_advance: string;
  notification_emails: string;
  timezone: string; currency: string; asset_subtypes_config?: string;
  country_code?: string | null;
  date_format?: string;
}
interface TwoFASetup { secret: string; qr_url: string; recovery_codes: string[]; }

// ─── Schemas ──────────────────────────────────────────────────────────────────
const ProfileSchema = z.object({
  full_name: z.string().min(1, 'Required').max(200),
  email: z.string().email('Invalid email'),
  professional_title: z.string().max(200).optional(),
});
type ProfileForm = z.infer<typeof ProfileSchema>;

const InstitutionSchema = z.object({
  name: z.string().min(1, 'Required').max(200),
  type: z.enum(['bank', 'brokerage', 'crypto_exchange', 'gold_silver', 'real_estate', 'other']),
  supported_channels: z.string().optional(),
});
type InstitutionForm = z.infer<typeof InstitutionSchema>;

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

// ─── Collapsible Section ─────────────────────────────────────────────────────
function Section({
  icon, title, defaultOpen = false, action, children,
}: {
  icon: string; title: string; defaultOpen?: boolean;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full p-5 flex items-center justify-between select-none hover:bg-white/5 transition-colors"
      >
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span>{icon}</span> {title}
        </h2>
        <div className="flex items-center gap-3">
          {action}
          <ChevronDown
            size={16}
            className={`text-text-secondary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-border-subtle pt-4">{children}</div>}
    </div>
  );
}

// ─── Email Tag Input ─────────────────────────────────────────────────────────
function EmailTagInput({ emails, onChange }: { emails: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const addEmail = () => {
    const val = input.trim().toLowerCase();
    if (!val) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setError('Email không hợp lệ'); return; }
    if (emails.includes(val)) { setError('Email đã tồn tại'); return; }
    onChange([...emails, val]);
    setInput('');
    setError('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
          placeholder="email@example.com"
          className="flex-1 bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green"
        />
        <button
          type="button"
          onClick={addEmail}
          className="px-3 py-2 bg-brand-green/10 text-brand-green border border-brand-green/30 rounded-lg hover:bg-brand-green/20 text-sm flex items-center gap-1"
        >
          <Plus size={14} /> Thêm
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {emails.map(em => (
            <span key={em} className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-full px-3 py-1 text-xs text-text-primary">
              <Mail size={11} className="text-brand-green" />
              {em}
              <button
                type="button"
                onClick={() => onChange(emails.filter(e => e !== em))}
                className="text-text-muted hover:text-red-400 ml-0.5"
                aria-label={`Remove ${em}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {emails.length === 0 && (
        <p className="text-xs text-text-muted italic">Chưa có email nào được cấu hình.</p>
      )}
    </div>
  );
}

// ─── Institution Modal ────────────────────────────────────────────────────────
function InstitutionModal({ existing, onClose, onSaved }: {
  existing?: Institution; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<InstitutionForm>({
    resolver: zodResolver(InstitutionSchema),
    defaultValues: existing ? { name: existing.name, type: existing.type as InstitutionForm['type'] } : { type: 'bank' },
  });
  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => {
    if (existing?.supported_channels) {
      try { return JSON.parse(existing.supported_channels); } catch { return []; }
    }
    return [];
  });

  const onSubmit = async (data: InstitutionForm) => {
    const body = { ...data, supported_channels: JSON.stringify(selectedChannels) };
    if (existing) await apiFetch(`/api/v1/institutions/${existing.id}`, { method: 'PUT', body });
    else await apiFetch('/api/v1/institutions', { method: 'POST', body });
    onSaved(); onClose();
  };

  const CHANNELS = [
    { id: 'markets', label: 'Markets / Stocks' },
    { id: 'metals', label: 'Metals' },
    { id: 'liquidity', label: 'Liquidity / Savings' },
    { id: 'real_estate', label: 'Real Estate' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">
          {existing ? t('settings.institutions.edit') : t('settings.institutions.addInstitution')}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.institutions.name')}</label>
            <input {...register('name')} className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green" />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.institutions.type')}</label>
            <select {...register('type')} className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green">
              {(['bank', 'brokerage', 'crypto_exchange', 'gold_silver', 'real_estate', 'other'] as const).map(v => (
                <option key={v} value={v}>{t(`enums.institutionTypes.${v}` as any)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-2 uppercase tracking-wide">Supported Channels</label>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map(ch => (
                <label key={ch.id} className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" className="rounded" checked={selectedChannels.includes(ch.id)}
                    onChange={e => setSelectedChannels(prev => e.target.checked ? [...prev, ch.id] : prev.filter(c => c !== ch.id))} />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary">
              {t('settings.institutions.cancel')}
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 rounded-lg bg-brand-green text-black font-medium disabled:opacity-50">
              {isSubmitting ? t('settings.saving') : t('settings.institutions.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────
const PasswordSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm_password: z.string().min(1, 'Required'),
}).refine(d => d.new_password === d.confirm_password, { message: 'Passwords do not match', path: ['confirm_password'] });
type PasswordForm = z.infer<typeof PasswordSchema>;

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PasswordForm>({ resolver: zodResolver(PasswordSchema) });

  const onSubmit = async (data: PasswordForm) => {
    setServerError('');
    try {
      await apiFetch('/api/v1/auth/change-password', { method: 'POST', body: { current_password: data.current_password, new_password: data.new_password } });
      onClose();
    } catch (e: unknown) { setServerError(e instanceof Error ? e.message : t('common.error')); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">{t('settings.security.changePassword')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && <p className="text-red-400 text-sm bg-red-400/10 rounded p-2">{serverError}</p>}
          {(['current_password', 'new_password', 'confirm_password'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
                {t(`settings.security.${field === 'current_password' ? 'currentPassword' : field === 'new_password' ? 'newPassword' : 'confirmPassword'}` as any)}
              </label>
              <input {...register(field)} type="password" className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green" />
              {errors[field] && <p className="text-red-400 text-xs mt-1">{errors[field]?.message}</p>}
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border-subtle text-text-secondary">{t('settings.security.cancel')}</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 rounded-lg bg-brand-green text-black font-medium disabled:opacity-50">
              {isSubmitting ? t('settings.saving') : t('settings.security.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 2FA Setup Modal ─────────────────────────────────────────────────────────
function TwoFASetupModal({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'loading' | 'scan'>('loading');
  const [setup, setSetup] = useState<TwoFASetup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ data: TwoFASetup }>('/api/v1/auth/2fa/setup', { method: 'POST' })
      .then(res => { setSetup(res.data); setStep('scan'); })
      .catch(() => { setError('Failed to initialize 2FA setup.'); setStep('scan'); });
  }, []);

  const handleEnable = async () => {
    if (code.length !== 6) { setError(t('login.errors.totpLength')); return; }
    setSubmitting(true); setError('');
    try {
      await apiFetch('/api/v1/auth/2fa/enable', { method: 'POST', body: { code } });
      onEnabled(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t('login.errors.invalidTotp')); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">{t('settings.security.twoFactor')}</h2>
        {step === 'loading' && <p className="text-text-secondary text-sm">{t('common.loading')}</p>}
        {step === 'scan' && setup && (<>
          <p className="text-text-secondary text-sm">Scan QR code bằng Google Authenticator, Authy... rồi nhập mã 6 chữ số để xác nhận.</p>
          <div className="flex justify-center"><img src={setup.qr_url} alt="2FA QR Code" className="w-48 h-48 bg-white p-2 rounded" /></div>
          {setup.recovery_codes.length > 0 && (
            <div className="bg-surface border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-400 font-medium mb-2">Lưu các recovery code này — sẽ không hiển thị lại:</p>
              <div className="grid grid-cols-2 gap-1">
                {setup.recovery_codes.map(rc => <code key={rc} className="text-xs font-mono text-text-primary bg-surface-card rounded px-2 py-0.5">{rc}</code>)}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('login.twoFactorCode')}</label>
            <input type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-1 focus:ring-brand-green"
              placeholder="000000" />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>
        </>)}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border-subtle text-text-secondary">{t('common.cancel')}</button>
          {setup && (
            <button type="button" onClick={() => void handleEnable()} disabled={submitting || code.length !== 6}
              className="flex-1 px-4 py-2 rounded-lg bg-brand-green text-black font-medium disabled:opacity-50">
              {submitting ? t('login.verifying') : t('login.verify')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2FA Disable Modal ────────────────────────────────────────────────────────
function TwoFADisableModal({ onClose, onDisabled }: { onClose: () => void; onDisabled: () => void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDisable = async () => {
    if (!password) { setError(t('login.errors.passwordRequired')); return; }
    setSubmitting(true); setError('');
    try {
      await apiFetch('/api/v1/auth/2fa/disable', { method: 'POST', body: { password } });
      onDisabled(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Tắt Xác thực 2 bước</h2>
        <p className="text-text-secondary text-sm">Nhập mật khẩu để xác nhận tắt 2FA.</p>
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.security.currentPassword')}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green" />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border-subtle text-text-secondary">{t('common.cancel')}</button>
          <button type="button" onClick={() => void handleDisable()} disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-medium disabled:opacity-50">
            {submitting ? t('settings.saving') : 'Tắt 2FA'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scheduler Types ──────────────────────────────────────────────────────────
interface ScheduledJob {
  id: number; name: string; job_type: string;
  cron_expression: string; enabled: boolean;
  last_run_at: string | null; last_run_status: string | null; last_run_log: string | null;
}
interface SmtpConfig {
  provider: 'gmail' | 'custom';
  host: string | null; port: number | null; secure: boolean;
  user: string | null; password: string | null;
  from_name: string; from_email: string | null;
}

const CRON_PRESETS = [
  { label: '8:30 sáng hàng ngày', value: '30 8 * * *' },
  { label: 'Hàng tuần Chủ nhật 2AM', value: '0 2 * * 0' },
  { label: 'Hàng đêm 23:00', value: '0 23 * * *' },
  { label: 'Mỗi giờ', value: '0 * * * *' },
];

const JOB_TYPE_LABELS: Record<string, string> = {
  calendar_reminder: '📅 Nhắc lịch',
  data_cleanup: '🧹 Dọn dẹp',
  nightly_summary: '📊 Tổng hợp',
};

// ─── Scheduler Section ────────────────────────────────────────────────────────
function SchedulerSection() {
  const { t } = useTranslation();
  const { success, error: toastError } = useToast();
  const [smtp, setSmtp] = useState<SmtpConfig | null>(null);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [smtpDraft, setSmtpDraft] = useState<Partial<SmtpConfig>>({});
  const [testTo, setTestTo] = useState('');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [smtpRes, jobsRes] = await Promise.all([
          apiFetch<{ data: SmtpConfig }>('/api/v1/scheduler/smtp'),
          apiFetch<{ data: ScheduledJob[] }>('/api/v1/scheduler/jobs'),
        ]);
        setSmtp(smtpRes.data);
        setSmtpDraft(smtpRes.data);
        setJobs(jobsRes.data ?? []);
      } catch { /* ignore — scheduler not yet configured */ }
    })();
  }, []);

  const provider = (smtpDraft.provider ?? smtp?.provider ?? 'gmail') as 'gmail' | 'custom';

  const saveSmtp = async () => {
    setSmtpSaving(true);
    try {
      const res = await apiFetch<{ data: SmtpConfig }>('/api/v1/scheduler/smtp', {
        method: 'PUT', body: JSON.stringify(smtpDraft),
      });
      setSmtp(res.data);
      setSmtpDraft(res.data);
      success(t('settings.scheduler.saved'));
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'Lỗi lưu SMTP');
    } finally { setSmtpSaving(false); }
  };

  const sendTest = async () => {
    if (!testTo) return;
    setTestSending(true);
    try {
      await apiFetch('/api/v1/scheduler/smtp/test', { method: 'POST', body: JSON.stringify({ to: testTo }) });
      success(t('settings.scheduler.testSent'));
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : t('settings.scheduler.testFailed'));
    } finally { setTestSending(false); }
  };

  const updateJob = async (id: number, patch: { name?: string; cron_expression?: string; enabled?: boolean }) => {
    try {
      const res = await apiFetch<{ data: ScheduledJob }>(`/api/v1/scheduler/jobs/${id}`, {
        method: 'PUT', body: JSON.stringify(patch),
      });
      setJobs(prev => prev.map(j => j.id === id ? res.data : j));
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'Lỗi cập nhật tác vụ');
    }
  };

  const runNow = async (id: number) => {
    setRunningId(id);
    try {
      const res = await apiFetch<{ data: { status: string; log: string } }>(`/api/v1/scheduler/jobs/${id}/run`, { method: 'POST' });
      const status = res.data.status === 'ok' ? '✅' : '❌';
      success(`${status} ${res.data.log?.slice(0, 80) ?? 'Done'}`);
      setJobs(prev => prev.map(j => j.id === id ? { ...j, last_run_status: res.data.status, last_run_at: new Date().toISOString() } : j));
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'Lỗi chạy tác vụ');
    } finally { setRunningId(null); }
  };

  const field = (label: string, children: React.ReactNode) => (
    <div className="space-y-1">
      <label className="block text-xs text-text-secondary uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );

  const inp = 'w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green';

  return (
    <Section icon="⏰" title={t('settings.scheduler.title')}>
      <div className="space-y-6">
        {/* SMTP config */}
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold mb-3">{t('settings.scheduler.smtpTitle')}</p>
          <div className="grid grid-cols-2 gap-4">
            {field(t('settings.scheduler.provider'),
              <select value={provider} onChange={e => setSmtpDraft(d => ({ ...d, provider: e.target.value as 'gmail' | 'custom' }))} className={inp}>
                <option value="gmail">{t('settings.scheduler.gmail')}</option>
                <option value="custom">{t('settings.scheduler.custom')}</option>
              </select>
            )}
            {field(t('settings.scheduler.fromName'),
              <input type="text" value={smtpDraft.from_name ?? ''} onChange={e => setSmtpDraft(d => ({ ...d, from_name: e.target.value }))} placeholder="Courtify" className={inp} />
            )}
            {field(t('settings.scheduler.user'),
              <input type="text" value={smtpDraft.user ?? ''} onChange={e => setSmtpDraft(d => ({ ...d, user: e.target.value }))} placeholder="your@gmail.com" className={inp} />
            )}
            {field(t('settings.scheduler.password'),
              <input type="password" value={smtpDraft.password ?? ''} onChange={e => setSmtpDraft(d => ({ ...d, password: e.target.value }))} placeholder="••••••••" className={inp} />
            )}
            {provider === 'custom' && <>
              {field(t('settings.scheduler.host'),
                <input type="text" value={smtpDraft.host ?? ''} onChange={e => setSmtpDraft(d => ({ ...d, host: e.target.value }))} placeholder="smtp.example.com" className={inp} />
              )}
              {field(t('settings.scheduler.port'),
                <input type="number" value={smtpDraft.port ?? ''} onChange={e => setSmtpDraft(d => ({ ...d, port: Number(e.target.value) }))} placeholder="587" className={inp} />
              )}
              <div className="col-span-2 flex items-center gap-3">
                <button type="button" onClick={() => setSmtpDraft(d => ({ ...d, secure: !d.secure }))}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${smtpDraft.secure ? 'bg-brand-green justify-end' : 'bg-surface-input border border-border-subtle justify-start'}`}>
                  <div className="w-4 h-4 rounded-full bg-white" />
                </button>
                <span className="text-sm text-text-primary">{t('settings.scheduler.secure')} (TLS/SSL)</span>
              </div>
            </>}
            {field(t('settings.scheduler.fromEmail'),
              <input type="email" value={smtpDraft.from_email ?? ''} onChange={e => setSmtpDraft(d => ({ ...d, from_email: e.target.value }))} placeholder="noreply@example.com" className={inp} />
            )}
          </div>
          <div className="flex items-end gap-3 mt-4">
            <button type="button" onClick={() => void saveSmtp()} disabled={smtpSaving}
              className="px-4 py-2 bg-brand-green text-black text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2">
              {smtpSaving ? <RefreshCw size={14} className="animate-spin" /> : null}
              {smtpSaving ? t('settings.scheduler.saving') : '💾 ' + t('settings.scheduler.saved').replace('Đã ', 'Lưu ')}
            </button>
            <div className="flex-1 flex gap-2">
              <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)}
                placeholder={t('settings.scheduler.testTo') + '...'}
                className={inp + ' flex-1'} />
              <button type="button" onClick={() => void sendTest()} disabled={testSending || !testTo}
                className="px-4 py-2 bg-surface border border-border-subtle text-text-primary text-sm rounded-lg hover:bg-white/5 disabled:opacity-50 flex items-center gap-2">
                {testSending ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                {t('settings.scheduler.testEmail')}
              </button>
            </div>
          </div>
        </div>

        {/* Jobs table */}
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold mb-3">{t('settings.scheduler.jobsTitle')}</p>
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="p-4 bg-surface rounded-xl border border-border-subtle space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 whitespace-nowrap">
                      {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                    </span>
                    <span className="text-sm text-text-primary truncate">{job.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => void runNow(job.id)} disabled={runningId === job.id}
                      className="px-3 py-1.5 text-xs bg-surface border border-border-subtle rounded-lg hover:bg-white/5 disabled:opacity-50 flex items-center gap-1.5">
                      {runningId === job.id ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                      {t('settings.scheduler.runNow')}
                    </button>
                    <button type="button" onClick={() => void updateJob(job.id, { enabled: !job.enabled })}
                      aria-label={job.enabled ? 'Disable job' : 'Enable job'}
                      className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${job.enabled ? 'bg-brand-green justify-end' : 'bg-surface-input border border-border-subtle justify-start'}`}>
                      <div className="w-4 h-4 rounded-full bg-white" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-text-secondary">{t('settings.scheduler.cronExpr')}</label>
                    <input type="text" value={job.cron_expression}
                      onChange={e => setJobs(prev => prev.map(j => j.id === job.id ? { ...j, cron_expression: e.target.value } : j))}
                      onBlur={e => void updateJob(job.id, { cron_expression: e.target.value })}
                      className={inp + ' font-mono text-xs'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-text-secondary">{t('settings.scheduler.presets')}</label>
                    <select className={inp + ' text-xs'} value=""
                      onChange={e => { if (e.target.value) void updateJob(job.id, { cron_expression: e.target.value }); }}>
                      <option value="">— chọn —</option>
                      {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-1 border-t border-border-subtle">
                  <span className="text-xs text-text-muted">{t('settings.scheduler.lastRun')}:</span>
                  {job.last_run_at ? (
                    <>
                      <span className="text-xs text-text-secondary">{new Date(job.last_run_at).toLocaleString('vi-VN')}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${job.last_run_status === 'ok' ? 'bg-brand-green/10 text-brand-green' : 'bg-red-500/10 text-red-400'}`}>
                        {job.last_run_status === 'ok' ? t('settings.scheduler.statusOk') : t('settings.scheduler.statusError')}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-text-muted italic">{t('settings.scheduler.never')}</span>
                  )}
                </div>
              </div>
            ))}
            {jobs.length === 0 && (
              <p className="text-sm text-text-muted italic text-center py-4">Chưa có tác vụ nào. Khởi động lại server để nạp dữ liệu mặc định.</p>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
export default function Settings() {
  const { t, i18n } = useTranslation();
  const { success, error: toastError } = useToast();
  const [lang, setLang] = useState<LangCode>(getCurrentLanguage());
  const { currency: activeCurrency, setCurrency, apiRates, rateStatus, refreshRates, reloadOverrides } = useCurrency();
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const raw = loadOverrides();
    const display: Record<string, string> = {};
    for (const [code, rate] of Object.entries(raw)) {
      display[code] = rate === 0 ? '' : (1 / rate).toFixed(0);
    }
    return display;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [showWizard, setShowWizard] = useState(false);
  const [appliedCountry, setAppliedCountry] = useState<CountryPreset | null>(null);
  const [notifEmails, setNotifEmails] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instModal, setInstModal] = useState<{ open: boolean; existing?: Institution }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<Institution | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notifDays, setNotifDays] = useState<number[]>([1, 3, 7]);
  const [activeInstTab, setActiveInstTab] = useState<'bank' | 'brokerage' | 'crypto_exchange' | 'gold_silver' | 'real_estate' | 'other'>('bank');

  const { register, handleSubmit, reset: resetProfile, formState: { errors: profileErrors } } = useForm<ProfileForm>({ resolver: zodResolver(ProfileSchema) });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, settRes, instRes, meRes] = await Promise.all([
        apiFetch<{ data: Profile }>('/api/v1/settings/profile'),
        apiFetch<{ data: AppSettings }>('/api/v1/settings'),
        apiFetch<{ data: Institution[] }>('/api/v1/institutions?include_archived=true'),
        apiFetch<{ data: { totp_enabled?: boolean } }>('/api/v1/auth/me'),
      ]);
      setProfile(profRes.data);
      setTotpEnabled(meRes.data?.totp_enabled ?? false);
      setSettings(settRes.data);
      setInstitutions(instRes.data ?? []);
      resetProfile({ full_name: profRes.data.full_name ?? '', email: profRes.data.email ?? '', professional_title: profRes.data.professional_title ?? '' });
      if (profRes.data.avatar_path) setAvatarPreview(`${API_BASE}${profRes.data.avatar_path}`);
      setTimezone(settRes.data.timezone ?? 'Asia/Ho_Chi_Minh');
      setDateFormat(settRes.data.date_format ?? 'DD/MM/YYYY');
      try {
        const days = JSON.parse(settRes.data.notification_days_advance ?? '[]');
        if (Array.isArray(days)) setNotifDays(days as number[]);
      } catch { /* ignore */ }
      try {
        const emails = JSON.parse(settRes.data.notification_emails ?? '[]');
        if (Array.isArray(emails)) setNotifEmails(emails as string[]);
      } catch { /* ignore */ }
    } finally { setLoading(false); }
  }, [resetProfile]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSave = async (data: ProfileForm) => {
    setSaving(true); setSaveError('');
    try {
      await apiFetch('/api/v1/settings/profile', { method: 'PUT', body: data });
      if (avatarFile) {
        const form = new FormData();
        form.append('avatar', avatarFile);
        await fetch(`${API_BASE}/api/v1/settings/avatar`, { method: 'POST', credentials: 'include', body: form });
      }
      await apiFetch('/api/v1/settings', {
        method: 'PUT',
        body: {
          notification_days_advance: JSON.stringify(notifDays),
          notification_emails: JSON.stringify(notifEmails),
          timezone,
          date_format: dateFormat,
          country_code: appliedCountry?.code ?? settings?.country_code ?? null,
          asset_subtypes_config: settings?.asset_subtypes_config,
        },
      });
      success(t('settings.saved'));
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    } finally { setSaving(false); }
  };

  const toggleNotifDay = (day: number) => setNotifDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const handleWizardApply = (preset: CountryPreset) => {
    setTimezone(preset.timezone);
    setCurrency(preset.currency);
    setDateFormat(preset.dateFormat);
    setLang(preset.language);
    setLanguage(preset.language);
    setAppliedCountry(preset);
  };

  const archiveInstitution = async (inst: Institution) => {
    try {
      await apiFetch(`/api/v1/institutions/${inst.id}/archive`, { method: 'POST' });
      success(t('settings.institutions.archive'), { message: `${inst.name} archived.` });
      void fetchAll();
    } catch (e: unknown) {
      toastError('Failed', { message: e instanceof Error ? e.message : '', status: e instanceof ApiError ? e.status : undefined });
    }
  };

  const restoreInstitution = async (inst: Institution) => {
    try {
      await apiFetch(`/api/v1/institutions/${inst.id}/restore`, { method: 'POST' });
      success(t('settings.institutions.restore'), { message: `${inst.name} restored.` });
      void fetchAll();
    } catch (e: unknown) {
      toastError('Failed', { message: e instanceof Error ? e.message : '', status: e instanceof ApiError ? e.status : undefined });
    }
  };

  const deleteInstitution = async (inst: Institution) => {
    try {
      await apiFetch(`/api/v1/institutions/${inst.id}`, { method: 'DELETE' });
      success('Deleted', { message: `${inst.name} removed.` });
      void fetchAll();
    } catch (e: unknown) {
      toastError('Failed', { message: e instanceof Error ? e.message : '', status: e instanceof ApiError ? e.status : undefined });
    } finally { setDeleteConfirm(null); }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-surface-card animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{t('settings.title')}</h1>
        <p className="text-text-secondary text-sm mt-1">Quản lý tài khoản, bảo mật và tuỳ chỉnh ứng dụng</p>
      </div>

      <form onSubmit={handleSubmit(onSave)}>
        {/* ── Row 1: Profile (full width) ── */}
        <div className="mb-4">
          <Section icon="👤" title={t('settings.profile.title')}>
            <div className="flex gap-6 items-start">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-20 h-20 rounded-full bg-surface border border-border-subtle overflow-hidden cursor-pointer"
                  onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}
                  aria-label="Change avatar" onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}>
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl text-text-secondary">{profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}</div>
                  }
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-text-secondary hover:text-brand-green">
                  {t('settings.profile.changeAvatar')}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} aria-label="Upload avatar" />
              </div>

              {/* Fields: 3-col grid */}
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.profile.fullName')}</label>
                  <input {...register('full_name')} className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-green" />
                  {profileErrors.full_name && <p className="text-red-400 text-xs mt-1">{profileErrors.full_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.profile.email')}</label>
                  <input {...register('email')} className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-green" />
                  {profileErrors.email && <p className="text-red-400 text-xs mt-1">{profileErrors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.profile.professionalTitle')}</label>
                  <input {...register('professional_title')} className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-green" />
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Row 2: two-col — Localization | Exchange Rates ── */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Localization */}
          <Section icon="🌐" title={t('settings.localization.title')}>
            <div className="space-y-4">
              {/* Wizard trigger */}
              <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border-subtle">
                <div className="flex items-center gap-2.5">
                  <Globe size={16} className="text-brand-green" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Cài đặt theo Quốc gia
                      {appliedCountry && (
                        <span className="ml-2 text-xs text-brand-green font-normal">
                          {appliedCountry.flag} {appliedCountry.nameVi} đã áp dụng
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-secondary">Tự động gợi ý múi giờ, tiền tệ, định dạng theo vùng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setShowWizard(true); }}
                  className="text-xs text-brand-green border border-brand-green/30 rounded-lg px-3 py-1.5 hover:bg-brand-green/10 flex items-center gap-1.5 shrink-0"
                >
                  🌍 Chọn quốc gia
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.localization.interfaceLanguage')}</label>
                  <select value={lang} onChange={e => { const c = e.target.value as LangCode; setLang(c); setLanguage(c); }}
                    className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-green">
                    {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">{t('settings.localization.primaryCurrency')}</label>
                  <select value={activeCurrency.code} onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-green">
                    {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {i18n.language === 'vi' ? c.nameVi : c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
                  🕐 {t('settings.localization.timezone')}
                </label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-brand-green">
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
                <p className="text-xs text-text-muted mt-1">Ảnh hưởng đến cách hiển thị ngày giờ trong toàn ứng dụng.</p>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Asset Subtypes Config (JSON)</label>
                <textarea
                  className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-green h-20 resize-none"
                  value={settings?.asset_subtypes_config ?? ''}
                  onChange={e => setSettings(s => s ? { ...s, asset_subtypes_config: e.target.value } : null)}
                  placeholder='{"markets": ["stock","crypto"]}'
                />
              </div>

              <div className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2 text-xs text-text-secondary">
                <span>
                  <span className="font-medium text-brand-green">{activeCurrency.symbol}</span>
                  {' '}{activeCurrency.code} · {activeCurrency.decimals === 0 ? t('settings.localization.noDecimals') : `${activeCurrency.decimals} ${t('settings.localization.decimals')}`}
                </span>
                <span className="text-border-subtle">|</span>
                <span>📅 {dateFormat}</span>
              </div>
            </div>
          </Section>

          {/* Exchange Rates */}
          <Section icon="💱" title={t('settings.exchangeRates.title')}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-text-secondary">{t('settings.exchangeRates.desc')}</p>
              <div className="flex items-center gap-2">
                {rateStatus.updatedAt && (
                  <span className="text-xs text-text-muted">
                    {rateStatus.updatedAt.toLocaleTimeString()}{' '}
                    <span className={`font-medium ${rateStatus.source === 'fallback' ? 'text-amber-400' : 'text-brand-green'}`}>
                      ({rateStatus.source === 'fallback' ? t('settings.exchangeRates.offline') : rateStatus.source === 'cache' ? t('settings.exchangeRates.cached') : t('settings.exchangeRates.live')})
                    </span>
                  </span>
                )}
                <button type="button" disabled={refreshing || rateStatus.loading}
                  onClick={async () => { setRefreshing(true); await refreshRates(); setRefreshing(false); }}
                  className="text-xs text-brand-green border border-brand-green/30 rounded px-2 py-1 hover:bg-brand-green/10 disabled:opacity-40">
                  {refreshing || rateStatus.loading ? t('settings.exchangeRates.refreshing') : t('settings.exchangeRates.refresh')}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_CURRENCIES.filter(c => c.code !== 'VND').map(cfg => {
                const apiRate = apiRates[cfg.code];
                const apiVndPer1 = apiRate && apiRate > 0 ? Math.round(1 / apiRate) : null;
                const hasOverride = overrides[cfg.code] !== undefined;
                return (
                  <div key={cfg.code} className="bg-surface border border-border-subtle rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-text-primary">{cfg.symbol} {cfg.code}</span>
                      <span className="text-xs text-text-muted">{i18n.language === 'vi' ? cfg.nameVi : cfg.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-muted shrink-0">1 {cfg.code} =</span>
                      <input type="number" min="1" step="1" value={overrides[cfg.code] ?? (apiVndPer1 ?? '')}
                        placeholder={apiVndPer1 ? String(apiVndPer1) : '...'}
                        onChange={e => setOverrides(prev => ({ ...prev, [cfg.code]: e.target.value }))}
                        onBlur={e => {
                          const val = parseFloat(e.target.value);
                          if (val > 0) { saveOverride(cfg.code, val); reloadOverrides(); }
                          else { clearOverride(cfg.code); setOverrides(prev => { const n = { ...prev }; delete n[cfg.code]; return n; }); reloadOverrides(); }
                        }}
                        className="w-full bg-surface-card border border-border-subtle rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-green font-mono" />
                      <span className="text-xs text-text-muted shrink-0">₫</span>
                      {hasOverride && (
                        <button type="button" title="Reset to API rate" onClick={() => { clearOverride(cfg.code); setOverrides(prev => { const n = { ...prev }; delete n[cfg.code]; return n; }); reloadOverrides(); }} className="text-xs text-text-muted hover:text-brand-red shrink-0">↺</button>
                      )}
                    </div>
                    {hasOverride && apiVndPer1 && <p className="text-xs text-amber-400 mt-1">{t('settings.exchangeRates.overridden')} · API: {apiVndPer1.toLocaleString()}₫</p>}
                    {!hasOverride && !apiVndPer1 && <p className="text-xs text-text-muted mt-1">{t('settings.exchangeRates.loadingRate')}</p>}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* ── Row 3: Institutions (full width) ── */}
        <div className="mb-4">
          <Section icon="🏛" title={t('settings.institutions.title')}
            action={
              <button type="button" onClick={e => { e.stopPropagation(); setInstModal({ open: true }); }}
                className="text-xs text-brand-green border border-brand-green/30 rounded px-2 py-1 hover:bg-brand-green/10 flex items-center gap-1"
                aria-label="Add institution">
                <Plus size={12} /> {t('settings.institutions.addInstitution')}
              </button>
            }>
            <p className="text-xs text-text-secondary mb-3">{t('settings.institutions.description')}</p>
            <div className="flex space-x-1 bg-surface rounded-lg p-1 mb-4 w-fit">
              {(['bank', 'brokerage', 'crypto_exchange', 'gold_silver', 'real_estate', 'other'] as const).map(type => (
                <button key={type} type="button" onClick={() => setActiveInstTab(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeInstTab === type ? 'bg-surface-card text-brand-green shadow-sm border border-border-subtle' : 'text-text-secondary hover:text-text-primary'}`}>
                  {t(`enums.institutionTypes.${type}` as any, { defaultValue: type })}
                </button>
              ))}
            </div>
            {institutions.filter(i => i.type === activeInstTab).length === 0
              ? <p className="text-text-secondary text-sm text-center py-4">{t('settings.institutions.noInstitutions')}</p>
              : (
                <ul className="divide-y divide-border-subtle" role="list">
                  {institutions.filter(i => i.type === activeInstTab).map(inst => (
                    <li key={inst.id} className={`flex items-center justify-between py-2.5 ${inst.archived_at ? 'opacity-50' : ''}`}>
                      <div>
                        <span className="text-text-primary text-sm font-medium">{inst.name}</span>
                        {inst.archived_at && <span className="ml-2 text-xs bg-surface text-text-secondary border border-border-subtle rounded px-1.5 py-0.5">archived</span>}
                        <div className="text-xs text-text-secondary mt-0.5">{t(`enums.institutionTypes.${inst.type}` as any, { defaultValue: inst.type })}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!inst.archived_at && (
                          <button type="button" onClick={() => setInstModal({ open: true, existing: inst })}
                            className="text-xs text-text-secondary hover:text-text-primary border border-border-subtle rounded px-2 py-1">
                            {t('settings.institutions.edit')}
                          </button>
                        )}
                        {inst.archived_at
                          ? <button type="button" onClick={() => void restoreInstitution(inst)} className="text-xs text-brand-green hover:underline">{t('settings.institutions.restore')}</button>
                          : <button type="button" onClick={() => void archiveInstitution(inst)} className="text-xs text-text-secondary hover:text-amber-400">{t('settings.institutions.archive')}</button>
                        }
                        <button type="button" onClick={() => setDeleteConfirm(inst)} className="text-xs text-red-400 hover:underline">{t('settings.institutions.delete')}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </Section>
        </div>

        {/* ── Row 4: two-col — Security | Notifications ── */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Security */}
          <Section icon="🔒" title={t('settings.security.title')}>
            <div className="space-y-4">
              <div className="flex items-start justify-between p-3 bg-surface rounded-lg">
                <div>
                  <p className="text-sm text-text-primary font-medium">{t('settings.security.twoFactor')}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{t('settings.security.twoFactorDesc')}</p>
                </div>
                <button type="button" onClick={() => totpEnabled ? setShow2FADisable(true) : setShow2FASetup(true)}
                  aria-label={totpEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 ml-4 ${totpEnabled ? 'bg-brand-green justify-end' : 'bg-surface-input border border-border-subtle justify-start'}`}>
                  <div className="w-4 h-4 rounded-full bg-white" />
                </button>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-sm text-text-primary font-medium mb-1">{t('settings.security.changePassword')}</p>
                <p className="text-xs text-text-secondary mb-3">Cập nhật mật khẩu đăng nhập định kỳ để bảo mật tài khoản.</p>
                <button type="button" onClick={() => setShowPassword(true)}
                  className="text-xs text-brand-green border border-brand-green/30 rounded px-3 py-1.5 hover:bg-brand-green/10 flex items-center gap-1.5">
                  🔑 {t('settings.security.changePassword')}
                </button>
              </div>
            </div>
          </Section>

          {/* Notifications */}
          <Section icon="🔔" title={t('settings.notifications.title')}>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-secondary mb-2">{t('settings.notifications.description')}</p>
                <div className="space-y-1">
                  {([1, 3, 7, 30] as const).map(day => (
                    <div key={day} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-surface">
                      <span className="text-sm text-text-primary">{t(`settings.notifications.${day}day` as Parameters<typeof t>[0])}</span>
                      <button type="button" onClick={() => toggleNotifDay(day)}
                        aria-label={`${notifDays.includes(day) ? 'Disable' : 'Enable'} ${day}-day notification`}
                        className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${notifDays.includes(day) ? 'bg-brand-green justify-end' : 'bg-surface-input border border-border-subtle justify-start'}`}>
                        <div className="w-4 h-4 rounded-full bg-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Row 5: Gmail Notification Recipients (full width) ── */}
        <div className="mb-6">
          <Section icon="📧" title="Cấu hình Email nhận thông báo">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <span className="text-amber-400 text-sm mt-0.5">⚠️</span>
                <div className="text-xs text-text-secondary">
                  <p className="font-medium text-text-primary mb-1">Thông báo qua Email (Gmail)</p>
                  <p>Thêm địa chỉ email để nhận cảnh báo tài chính (đến hạn sổ tiết kiệm, khoản vay, sự kiện lịch...). Hỗ trợ nhiều tài khoản Gmail và email doanh nghiệp.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs text-text-secondary mb-2 uppercase tracking-wide">Danh sách email nhận thông báo</label>
                  <EmailTagInput emails={notifEmails} onChange={setNotifEmails} />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-text-secondary mb-2 uppercase tracking-wide">Loại thông báo sẽ nhận</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'maturity', label: '🏦 Đến hạn sổ tiết kiệm', checked: true },
                      { id: 'loan_due', label: '💳 Đến hạn khoản vay', checked: true },
                      { id: 'calendar', label: '📅 Sự kiện lịch tài chính', checked: true },
                      { id: 'weekly_summary', label: '📊 Báo cáo tổng hợp tuần', checked: false },
                    ].map(item => (
                      <label key={item.id} className="flex items-center gap-2.5 text-sm text-text-primary cursor-pointer hover:text-text-primary/80">
                        <input type="checkbox" defaultChecked={item.checked}
                          className="w-3.5 h-3.5 rounded border-border-subtle text-brand-green focus:ring-brand-green" />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-3 pt-3 border-t border-border-subtle">
                    💡 Thời điểm gửi phụ thuộc vào cấu hình <strong>"Nhắc trước"</strong> ở mục Thông báo phía trên.
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Row 6: Scheduler ── */}
        <div className="mb-6">
          <SchedulerSection />
        </div>

        {/* ── Save Bar ── */}
        <div className="flex items-center justify-between gap-4 p-4 bg-surface-card border border-border-subtle rounded-xl">
          <div className="text-xs text-text-secondary">
            {saveError ? <span className="text-red-400">{saveError}</span> : 'Nhấn Lưu để áp dụng tất cả thay đổi.'}
          </div>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-brand-green text-black font-medium disabled:opacity-50 flex items-center gap-2 text-sm">
            {saving ? t('settings.saving') : `💾 ${t('settings.saveChanges')}`}
          </button>
        </div>
      </form>

      {/* ── Modals ── */}
      {instModal.open && <InstitutionModal existing={instModal.existing} onClose={() => setInstModal({ open: false })} onSaved={() => void fetchAll()} />}
      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
      {show2FASetup && <TwoFASetupModal onClose={() => setShow2FASetup(false)} onEnabled={() => setTotpEnabled(true)} />}
      {show2FADisable && <TwoFADisableModal onClose={() => setShow2FADisable(false)} onDisabled={() => setTotpEnabled(false)} />}
      {showWizard && (
        <RegionalWizardModal
          onClose={() => setShowWizard(false)}
          onApply={handleWizardApply}
          currentLang={lang}
        />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
          <div className="bg-surface-card border border-border-subtle rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-text-primary">{t('settings.institutions.confirmDelete')}</h3>
            <p className="text-text-secondary text-sm"><strong>{deleteConfirm.name}</strong></p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 rounded-lg border border-border-subtle text-text-secondary">{t('settings.institutions.cancel')}</button>
              <button type="button" onClick={() => void deleteInstitution(deleteConfirm)} className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-medium">{t('settings.institutions.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
