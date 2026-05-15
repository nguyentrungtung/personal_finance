import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('loans', (t) => {
    t.increments('id').primary();
    t.text('loan_type').notNullable(); // lent | borrowed
    t.text('counterparty_name').notNullable();
    t.text('description');
    t.text('principal').notNullable();
    t.text('date_issued').notNullable(); // YYYY-MM-DD
    t.text('expected_due_date').notNullable(); // YYYY-MM-DD
    t.text('repayment_terms');
    t.text('status').notNullable().defaultTo('active');
    // active | overdue | settled — computed at query time
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw('CREATE INDEX idx_loans_type ON loans (loan_type)');
  await knex.raw('CREATE INDEX idx_loans_status ON loans (status)');
  await knex.raw('CREATE INDEX idx_loans_due_date ON loans (expected_due_date)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('loans');
}
