import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('calendar_events', (t) => {
    t.increments('id').primary();
    t.text('title').notNullable();
    t.text('event_type').notNullable();
    // maturity | debt_due | savings_goal | loan_settled | other
    t.text('due_date').notNullable(); // YYYY-MM-DD
    t.text('amount'); // optional VND string
    t.integer('asset_class_id').references('id').inTable('asset_classes');
    t.integer('linked_savings_id').references('id').inTable('savings_instruments');
    t.integer('linked_loan_id').references('id').inTable('loans');
    t.integer('linked_ledger_id').references('id').inTable('ledger_entries');
    t.text('notes');
    t.integer('is_dismissed').notNullable().defaultTo(0);
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw('CREATE INDEX idx_calendar_due_date ON calendar_events (due_date ASC)');
  await knex.raw('CREATE INDEX idx_calendar_event_type ON calendar_events (event_type)');
  await knex.raw('CREATE INDEX idx_calendar_dismissed ON calendar_events (is_dismissed)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('calendar_events');
}
