import { Bell, X, ChevronRight, CheckCheck, Menu } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: number;
  title: string;
  event_type: 'maturity' | 'debt_due' | 'savings_goal' | 'loan_settled' | 'other';
  due_date: string;
  amount?: string;
  notes?: string;
  days_until: number;
  is_dismissed: number;
}

interface SettingsResponse {
  data: {
    notification_days_advance: string;
  };
}

interface CalendarResponse {
  data: CalendarEvent[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_ICONS: Record<string, string> = {
  maturity:     '🏦',
  debt_due:     '💳',
  savings_goal: '🎯',
  loan_settled: '✅',
  other:        '📌',
};

const EVENT_TYPE_COLOR: Record<string, string> = {
  maturity:     'text-blue-400  bg-blue-400/10  border-blue-400/20',
  debt_due:     'text-red-400   bg-red-400/10   border-red-400/20',
  savings_goal: 'text-brand-green bg-brand-green/10 border-brand-green/20',
  loan_settled: 'text-text-muted  bg-surface       border-border-subtle',
  other:        'text-amber-400 bg-amber-400/10  border-amber-400/20',
};

function urgencyLabel(days: number): { label: string; color: string } {
  if (days < 0)  return { label: 'Overdue',   color: 'text-red-500' };
  if (days === 0) return { label: 'Today',     color: 'text-red-400' };
  if (days === 1) return { label: 'Tomorrow',  color: 'text-amber-400' };
  if (days <= 3)  return { label: `${days}d`,  color: 'text-amber-400' };
  if (days <= 7)  return { label: `${days}d`,  color: 'text-yellow-400' };
  return               { label: `${days}d`,  color: 'text-text-muted' };
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    maturity: 'Maturity',
    debt_due: 'Debt Due',
    savings_goal: 'Savings Goal',
    loan_settled: 'Loan',
    other: 'Other',
  };
  return map[type] ?? type;
}

// ─── Notification Dropdown ────────────────────────────────────────────────────

interface NotifDropdownProps {
  events: CalendarEvent[];
  advanceDays: number;
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
  onNavigate: () => void;
}

function NotifDropdown({ events, advanceDays, onDismiss, onDismissAll, onNavigate }: NotifDropdownProps) {
  const urgent = events.filter(e => e.days_until <= advanceDays);
  const upcoming = events.filter(e => e.days_until > advanceDays);

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 max-[380px]:w-[calc(100vw-2rem)] bg-surface-card border border-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">Notifications</span>
          {urgent.length > 0 && (
            <span className="text-xs bg-amber-500 text-black font-bold rounded-full px-1.5 py-0.5 leading-none">
              {urgent.length}
            </span>
          )}
        </div>
        {events.length > 0 && (
          <button
            type="button"
            onClick={onDismissAll}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
            aria-label="Dismiss all"
          >
            <CheckCheck size={12} />
            Dismiss all
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-2xl mb-2">🔔</p>
            <p className="text-sm text-text-secondary">No upcoming events</p>
            <p className="text-xs text-text-muted mt-1">All clear for now</p>
          </div>
        ) : (
          <>
            {/* Urgent section */}
            {urgent.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  ⚡ Needs attention
                </p>
                {urgent.map(event => (
                  <NotifItem key={event.id} event={event} onDismiss={onDismiss} />
                ))}
              </div>
            )}

            {/* Upcoming section */}
            {upcoming.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
                  📅 Upcoming
                </p>
                {upcoming.map(event => (
                  <NotifItem key={event.id} event={event} onDismiss={onDismiss} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border-subtle">
        <button
          type="button"
          onClick={onNavigate}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-text-secondary hover:text-brand-green hover:bg-brand-green/5 transition-colors"
        >
          View Calendar
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

function NotifItem({ event, onDismiss }: { event: CalendarEvent; onDismiss: (id: number) => void }) {
  const icon = EVENT_TYPE_ICONS[event.event_type] ?? '📌';
  const color = EVENT_TYPE_COLOR[event.event_type] ?? EVENT_TYPE_COLOR.other;
  const { label, color: urgColor } = urgencyLabel(event.days_until);
  const typeLabel = formatEventType(event.event_type);

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors group">
      {/* Icon badge */}
      <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${color}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary font-medium leading-snug truncate">{event.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-muted">{typeLabel}</span>
          <span className="text-text-muted">·</span>
          <span className={`text-xs font-semibold ${urgColor}`}>{label}</span>
        </div>
        {event.amount && (
          <p className="text-xs text-text-muted mt-0.5 font-mono">
            {Number(event.amount).toLocaleString('vi-VN')} ₫
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDismiss(event.id); }}
        className="shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface opacity-0 group-hover:opacity-100 transition-all"
        aria-label={`Dismiss ${event.title}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [advanceDays, setAdvanceDays] = useState(7);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasUrgent = events.some(e => e.days_until <= advanceDays && e.days_until >= 0);

  // ── Fetch events + settings ──────────────────────────────────────────────
  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const [eventsRes, settingsRes] = await Promise.all([
        api.get<CalendarResponse>('/api/v1/calendar', signal),
        api.get<SettingsResponse>('/api/v1/settings', signal),
      ]);

      const rawEvents = (eventsRes as unknown as CalendarResponse).data ?? [];
      setEvents(rawEvents.filter(e => !e.is_dismissed));

      const rawDays: unknown = (settingsRes as unknown as SettingsResponse).data?.notification_days_advance;
      let parsed: number[] = [7];
      try {
        parsed = JSON.parse(typeof rawDays === 'string' ? rawDays : '[]') as number[];
      } catch { /* ignore */ }
      setAdvanceDays(Array.isArray(parsed) && parsed.length > 0 ? Math.max(...parsed) : 7);
    } catch {
      // Silently ignore — bell simply won't show badge
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    void fetchNotifications(controller.signal);

    // Re-check every 5 minutes
    const interval = setInterval(() => void fetchNotifications(), 5 * 60 * 1000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [isAuthenticated, fetchNotifications]);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Dismiss single ───────────────────────────────────────────────────────
  const handleDismiss = async (id: number) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    try {
      await apiFetch(`/api/v1/calendar/${id}/dismiss`, { method: 'PATCH' });
    } catch {
      // Re-fetch to restore state if it failed
      void fetchNotifications();
    }
  };

  // ── Dismiss all ──────────────────────────────────────────────────────────
  const handleDismissAll = async () => {
    const ids = events.map(e => e.id);
    setEvents([]);
    try {
      await Promise.all(ids.map(id => apiFetch(`/api/v1/calendar/${id}/dismiss`, { method: 'PATCH' })));
    } catch {
      void fetchNotifications();
    }
  };

  return (
    <header
      className="fixed top-0 left-0 lg:left-56 right-0 h-14 bg-surface-card border-b border-surface-border flex items-center justify-between lg:justify-end px-4 lg:px-6 z-10"
      role="banner"
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className="lg:hidden font-bold text-text-primary tracking-tight">COURTIFY</div>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="relative p-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          aria-label={hasUrgent ? t('common.notificationsUrgent') : t('common.notifications')}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Bell size={18} aria-hidden="true" />
          {hasUrgent && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-amber animate-pulse"
              aria-hidden="true"
            />
          )}
          {!hasUrgent && events.length > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-text-muted"
              aria-hidden="true"
            />
          )}
        </button>

        {open && (
          <NotifDropdown
            events={events}
            advanceDays={advanceDays}
            onDismiss={(id) => void handleDismiss(id)}
            onDismissAll={() => void handleDismissAll()}
            onNavigate={() => { setOpen(false); void navigate('/calendar'); }}
          />
        )}
      </div>
    </header>
  );
}
