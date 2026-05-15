import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ledger_entries', (t) => {
    t.increments('id').primary();
    t.integer('asset_class_id').notNullable().references('id').inTable('asset_classes');
    t.integer('institution_id').references('id').inTable('institutions');
    t.text('entry_type').notNullable();
    // crypto_purchase | real_estate_appraisal | tax_transfer | savings_deposit | loan_repayment | other
    t.text('description').notNullable();
    t.text('amount').notNullable(); // signed VND string
    t.text('status').notNullable().defaultTo('completed');
    // completed | pending | appraisal | cleared
    t.text('transaction_date').notNullable();
    t.text('attachment_path');
    t.text('notes');
    t.text('deleted_at');
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw('CREATE INDEX idx_ledger_asset_class ON ledger_entries (asset_class_id)');
  await knex.raw('CREATE INDEX idx_ledger_status ON ledger_entries (status)');
  await knex.raw(
    'CREATE INDEX idx_ledger_transaction_date ON ledger_entries (transaction_date DESC)'
  );
  await knex.raw('CREATE INDEX idx_ledger_institution ON ledger_entries (institution_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ledger_entries');
}
