import type { CalendarRepository } from './calendar.repository.js';
import { NotFoundError } from '../../shared/errors.js';
import type { CreateCalendarEventDto, UpdateCalendarEventDto, ListEventsParams } from './calendar.types.js';

export class CalendarService {
  constructor(private readonly repo: CalendarRepository) {}

  listEvents(params: ListEventsParams = {}) {
    const { eventType, includeDismissed = false } = params;
    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    if (!includeDismissed) {
      conditions.push('is_dismissed = 0');
    }
    if (eventType) {
      conditions.push('event_type = ?');
      bindings.push(eventType);
    }

    return this.repo.findAll(conditions, bindings);
  }

  getEventById(id: number) {
    const row = this.repo.findById(id);
    if (!row) throw new NotFoundError('Calendar event', id);
    return row;
  }

  createEvent(data: CreateCalendarEventDto) {
    const id = this.repo.create(data);
    return this.getEventById(id);
  }

  updateEvent(id: number, data: UpdateCalendarEventDto) {
    this.getEventById(id);
    const sets: string[] = ["updated_at = datetime('now')"];
    const vals: (string | number | null)[] = [];

    if (data.title !== undefined) { sets.push('title = ?'); vals.push(data.title); }
    if (data.event_type !== undefined) { sets.push('event_type = ?'); vals.push(data.event_type); }
    if (data.due_date !== undefined) { sets.push('due_date = ?'); vals.push(data.due_date); }
    if (data.amount !== undefined) { sets.push('amount = ?'); vals.push(data.amount); }
    if (data.asset_class_id !== undefined) { sets.push('asset_class_id = ?'); vals.push(data.asset_class_id); }
    if (data.notes !== undefined) { sets.push('notes = ?'); vals.push(data.notes); }

    this.repo.update(id, sets, vals);
    return this.getEventById(id);
  }

  deleteEvent(id: number) {
    this.getEventById(id);
    this.repo.delete(id);
    return { id, deleted: true };
  }

  dismissEvent(id: number) {
    this.getEventById(id);
    this.repo.dismiss(id);
    return this.getEventById(id);
  }
}
