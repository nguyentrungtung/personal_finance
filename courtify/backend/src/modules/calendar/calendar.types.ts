export interface CalendarEventRow {
  id: number;
  title: string;
  event_type: string;
  due_date: string;
  amount: string | null;
  asset_class_id: number | null;
  linked_savings_id: number | null;
  linked_loan_id: number | null;
  linked_ledger_id: number | null;
  notes: string | null;
  is_dismissed: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventDto {
  title: string;
  event_type: string;
  due_date: string;
  amount?: string;
  asset_class_id?: number;
  linked_savings_id?: number;
  linked_loan_id?: number;
  linked_ledger_id?: number;
  notes?: string;
}

export type UpdateCalendarEventDto = Partial<Pick<CreateCalendarEventDto, 'title' | 'event_type' | 'due_date' | 'amount' | 'asset_class_id' | 'notes'>>;

export interface ListEventsParams {
  eventType?: string;
  includeDismissed?: boolean;
}
