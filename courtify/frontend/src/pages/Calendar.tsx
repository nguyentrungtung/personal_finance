import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { abbreviateVND } from '../lib/vnd';
import { VNDInput } from '../components/shared/VNDInput';

interface CalendarEvent {
  id: number;
  title: string;
  event_type: string;
  due_date: string;
  days_until: number;
  amount?: string;
  asset_class_id?: number;
  notes?: string;
  is_dismissed: number;
}

const EventSchema = z.object({
  title: z.string().min(1, 'Required'),
  event_type: z.enum(['maturity', 'debt_due', 'savings_goal', 'loan_settled', 'other']),
  due_date: z.string().min(1, 'Required'),
  amount: z.string().optional(),
  notes: z.string().optional(),
});

type EventForm = z.infer<typeof EventSchema>;

const EVENT_DOT_COLOR: Record<string, string> = {
  maturity: 'bg-amber-400',
  debt_due: 'bg-red-400',
  savings_goal: 'bg-green-400',
  loan_settled: 'bg-blue-400',
  other: 'bg-gray-400',
};

const EVENT_BADGE_COLOR: Record<string, string> = {
  maturity: 'bg-amber-900/40 border-amber-700 text-amber-300',
  debt_due: 'bg-red-900/40 border-red-700 text-red-300',
  savings_goal: 'bg-green-900/40 border-green-700 text-green-300',
  loan_settled: 'bg-blue-900/40 border-blue-700 text-blue-300',
  other: 'bg-gray-800 border-gray-600 text-gray-300',
};

// Build 6-week grid for a given year/month (0-indexed month)
function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Calendar() {
  const { t, i18n } = useTranslation();
  const { success, error: toastError } = useToast();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // ── Drag & Drop state ──────────────────────────────────────────────────────
  const [dragEventId, setDragEventId] = useState<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const EVENT_TYPE_LABELS: Record<string, string> = {
    maturity: t('enums.statuses.matured'),
    debt_due: t('loans.table.dueDate'),
    savings_goal: t('nav.savings'),
    loan_settled: t('enums.statuses.settled'),
    other: t('enums.entryTypes.other'),
  };

  const DAYS_OF_WEEK = [
    t('calendar.sunday'),
    t('calendar.monday'),
    t('calendar.tuesday'),
    t('calendar.wednesday'),
    t('calendar.thursday'),
    t('calendar.friday'),
    t('calendar.saturday'),
  ];

  const MONTHS = i18n.language === 'vi'
    ? ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<EventForm>({
    resolver: zodResolver(EventSchema),
    defaultValues: { event_type: 'other' },
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: CalendarEvent[] }>('/api/v1/calendar');
      setEvents(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await apiFetch('/api/v1/calendar', { method: 'POST', body: data });
      success(t('calendar.addEvent'), { message: 'Event added.' });
      setShowModal(false);
      reset();
      void fetchEvents();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  });

  const handleDismiss = async (id: number) => {
    try {
      await apiFetch(`/api/v1/calendar/${id}/dismiss`, { method: 'PATCH' });
      success('Updated', { message: 'Event updated.' });
      setSelectedEvent(ev => ev?.id === id ? { ...ev, is_dismissed: 1 } : ev);
      void fetchEvents();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/v1/calendar/${id}`, { method: 'DELETE' });
      success('Updated', { message: 'Event updated.' });
      setSelectedEvent(null);
      void fetchEvents();
    } catch (e: unknown) {
      toastError('Operation failed', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  // ── Drag & Drop handlers ───────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, eventId: number) => {
    setDragEventId(eventId);
    e.dataTransfer.effectAllowed = 'move';
    // Needed for Firefox
    e.dataTransfer.setData('text/plain', String(eventId));
  };

  const handleDragEnd = () => {
    setDragEventId(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateKey);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when leaving the cell entirely (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverDate(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);

    if (!dragEventId) return;

    const ev = events.find(ev => ev.id === dragEventId);
    if (!ev || ev.due_date === targetDate) {
      setDragEventId(null);
      return;
    }

    const originalDate = ev.due_date;

    // Optimistic update — move event in local state immediately
    setEvents(prev =>
      prev.map(e => e.id === dragEventId ? { ...e, due_date: targetDate } : e)
    );
    // Update selected date panel to follow the moved event
    setSelectedDate(targetDate);
    setDragEventId(null);

    try {
      await apiFetch(`/api/v1/calendar/${dragEventId}`, {
        method: 'PUT',
        body: { due_date: targetDate },
      });
      success('Đã di chuyển', { message: `Sự kiện đã chuyển sang ${formatDateLabelLocal(targetDate)}` });
    } catch (e: unknown) {
      // Rollback on failure
      setEvents(prev =>
        prev.map(ev => ev.id === dragEventId ? { ...ev, due_date: originalDate } : ev)
      );
      setSelectedDate(originalDate);
      toastError('Không thể di chuyển', { message: e instanceof Error ? e.message : 'Unknown error', status: e instanceof ApiError ? e.status : undefined, code: e instanceof ApiError ? e.code : undefined });
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const grid = buildCalendarGrid(viewYear, viewMonth);
  const todayKey = toDateKey(today);

  // Map event due_date → events[]
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!eventsByDate[ev.due_date]) eventsByDate[ev.due_date] = [];
    eventsByDate[ev.due_date].push(ev);
  }

  // Selected date events
  const selectedDateEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  const formatDateLabelLocal = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-4 lg:p-6 flex flex-col lg:flex-row gap-6 min-h-full">
      {/* ── Left: Calendar grid ─────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 lg:mb-1">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {MONTHS[viewMonth]} {viewYear}
            </h1>
            <p className="text-sm text-gray-400">
              {t('calendar.subtitle')}
              {dragEventId && (
                <span className="ml-2 text-green-400 animate-pulse">↔ Kéo thả để đổi ngày</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-auto sm:mr-0">
              <button
                onClick={prevMonth}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 border border-[#333] rounded-lg hover:bg-[#222]"
              >
                ‹ {t('ledger.prev')}
              </button>
              <button
                onClick={nextMonth}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-300 border border-[#333] rounded-lg hover:bg-[#222]"
              >
                {t('ledger.next')} ›
              </button>
            </div>
            <button
              onClick={() => { setShowModal(true); reset(); }}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-1.5 rounded-lg text-sm w-full sm:w-auto justify-center"
            >
              {t('calendar.addEvent')}
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mt-4 mb-1">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 uppercase py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="grid grid-cols-7 border-t border-l border-[#222]">
            {Array(35).fill(null).map((_, i) => (
              <div key={i} className="border-b border-r border-[#222] h-24 animate-pulse bg-[#111]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 border-t border-l border-[#222]">
            {grid.map((date, idx) => {
              const key = date ? toDateKey(date) : `empty-${idx}`;
              const isToday = date ? key === todayKey : false;
              const isSelected = date ? key === selectedDate : false;
              const dayEvents = date ? (eventsByDate[key] ?? []) : [];

              return (
                <div
                  key={key}
                  onClick={() => date && setSelectedDate(key)}
                  onDragOver={date ? (e) => handleDragOver(e, key) : undefined}
                  onDragLeave={date ? handleDragLeave : undefined}
                  onDrop={date ? (e) => void handleDrop(e, key) : undefined}
                  className={`border-b border-r border-[#222] min-h-[96px] p-1.5 relative transition-colors
                    ${date ? 'cursor-pointer hover:bg-[#161616]' : 'bg-[#0a0a0a]'}
                    ${isSelected && dragOverDate !== key ? 'bg-[#1a2a1a]' : ''}
                    ${dragOverDate === key ? 'bg-green-900/20 ring-1 ring-inset ring-green-600' : ''}
                  `}
                >
                  {date && (
                    <>
                      {/* Day number */}
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-green-500 text-black font-bold' : 'text-gray-400'}
                      `}>
                        {date.getDate()}
                      </div>

                      {/* Event chips (max 2, then +N) */}
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(ev => (
                          <div
                            key={ev.id}
                            draggable={ev.is_dismissed === 0}
                            onDragStart={ev.is_dismissed === 0 ? (e) => { e.stopPropagation(); handleDragStart(e, ev.id); } : undefined}
                            onDragEnd={handleDragEnd}
                            onClick={e => { e.stopPropagation(); setSelectedDate(key); setSelectedEvent(ev); }}
                            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border truncate
                              ${EVENT_BADGE_COLOR[ev.event_type] ?? EVENT_BADGE_COLOR.other}
                              ${ev.is_dismissed ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'}
                              ${dragEventId === ev.id ? 'opacity-40 scale-95' : ''}
                            `}
                            title={ev.is_dismissed === 0 ? `${ev.title} — kéo để đổi ngày` : ev.title}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_DOT_COLOR[ev.event_type] ?? 'bg-gray-400'}`} />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-500 pl-1">+{dayEvents.length - 2} {t('calendar.more')}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: Event panel ──────────────────────────── */}
      <div className="w-full lg:w-72 shrink-0">
        {selectedDate ? (
          <div className="bg-[#111] border border-[#222] rounded-xl p-5 sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">
                {t('calendar.eventsFor')} {formatDateLabelLocal(selectedDate)}
              </h2>
              <button
                onClick={() => { setSelectedDate(null); setSelectedEvent(null); }}
                className="text-gray-500 hover:text-white text-lg leading-none"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{selectedDateEvents.length} {t('ledger.entries')}</span>
              <button
                onClick={() => {
                  setValue('due_date', selectedDate);
                  setShowModal(true);
                }}
                className="text-xs text-green-400 border border-green-800 rounded px-2 py-0.5 hover:bg-green-900/20"
              >
                {t('calendar.addEvent')}
              </button>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                <p>{t('calendar.noEvents')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map(ev => (
                  <div
                    key={ev.id}
                    className={`border-l-2 pl-3 py-1 rounded-r
                      ${ev.days_until <= 7 && ev.days_until >= 0 ? 'border-amber-400' :
                        ev.days_until < 0 ? 'border-red-500' : 'border-green-600'}
                      ${ev.id === selectedEvent?.id ? 'bg-[#1a2a1a] rounded' : ''}
                    `}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${ev.is_dismissed ? 'line-through text-gray-500' : 'text-white'}`}>
                          {ev.is_dismissed === 0 && ev.days_until <= 7 && ev.days_until >= 0 && (
                            <span className="text-amber-400 mr-1">⚠</span>
                          )}
                          {ev.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                          {ev.amount && ` · ${abbreviateVND(parseFloat(ev.amount))}`}
                        </p>
                        {ev.days_until < 0 && (
                          <p className="text-xs text-red-400 mt-0.5">{Math.abs(ev.days_until)}d {t('enums.statuses.overdue')}</p>
                        )}
                        {ev.days_until >= 0 && (
                          <p className={`text-xs mt-0.5 ${ev.days_until <= 7 ? 'text-amber-400' : 'text-gray-500'}`}>
                            {ev.days_until === 0 ? t('calendar.today') : `${ev.days_until}d`}
                          </p>
                        )}
                      </div>
                    </div>

                    {ev.notes && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{ev.notes}</p>
                    )}

                    <div className="flex gap-2 mt-2">
                      {ev.is_dismissed === 0 && (
                        <button
                          onClick={() => void handleDismiss(ev.id)}
                          className="text-xs text-green-400 border border-green-800 rounded px-2 py-0.5 hover:bg-green-900/20"
                        >
                          {t('calendar.markDone')}
                        </button>
                      )}
                      <button
                        onClick={() => void handleDelete(ev.id)}
                        className="text-xs text-red-400 border border-red-800 rounded px-2 py-0.5 hover:bg-red-900/20"
                      >
                        {t('calendar.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-xl p-5 text-center text-gray-500 text-sm sticky top-6">
            <div className="text-2xl mb-2">📅</div>
            <p>{t('calendar.noEventsDesc')}</p>
          </div>
        )}
      </div>

      {/* ── Add Event Modal ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-400">📅</span>
              <h2 className="text-lg font-bold text-white">{t('calendar.addEvent')}</h2>
              <button
                onClick={() => { setShowModal(false); reset(); }}
                className="ml-auto text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('calendar.eventTitle')}</label>
                <input
                  {...register('title')}
                  placeholder={t('calendar.eventPlaceholder')}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600"
                />
                {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('calendar.eventType')}</label>
                <select
                  {...register('event_type')}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                >
                  {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('calendar.eventDate')}</label>
                  <input
                    type="date"
                    {...register('due_date')}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                  {errors.due_date && <p className="text-red-400 text-xs mt-1">{errors.due_date.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('ledger.amountVnd')}</label>
                  <VNDInput
                    onChange={(v: string) => setValue('amount', v || undefined)}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">{t('calendar.eventNotes')}</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  placeholder="..."
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); reset(); }}
                  className="px-5 py-2 text-sm text-gray-300 bg-[#1a1a1a] rounded-lg hover:bg-[#222]"
                >
                  {t('calendar.cancel')}
                </button>
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-400 text-black font-semibold px-5 py-2 rounded-lg text-sm"
                >
                  {t('calendar.addEvent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

