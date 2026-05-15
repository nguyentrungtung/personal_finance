import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('loan_payments', (t) => {
    t.increments('id').primary();
    t.integer('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE');
    t.text('scheduled_amount').notNullable();
    t.text('due_date').notNullable(); // YYYY-MM-DD
    t.text('paid_amount').defaultTo('0.0000');
    t.text('paid_date'); // YYYY-MM-DD; NULL until paid
    t.text('status').notNullable().defaultTo('scheduled');
    // scheduled | paid | overdue
    t.text('notes');
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw('CREATE INDEX idx_loan_payments_loan ON loan_payments (loan_id)');
  await knex.raw('CREATE INDEX idx_loan_payments_due ON loan_payments (due_date)');
  await knex.raw('CREATE INDEX idx_loan_payments_status ON loan_payments (status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('loan_payments');
}
