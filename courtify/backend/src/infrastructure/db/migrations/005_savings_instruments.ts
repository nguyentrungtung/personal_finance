import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('savings_instruments', (t) => {
    t.increments('id').primary();
    t.integer('institution_id').notNullable().references('id').inTable('institutions');
    t.text('label').notNullable();
    t.text('instrument_type').notNullable();
    // savings_account | certificate_of_deposit | money_market | treasury_bond
    t.text('principal').notNullable(); // VND string, CHECK > 0
    t.text('interest_rate').notNullable(); // annual % string e.g. "7.5000"
    t.text('start_date').notNullable(); // YYYY-MM-DD
    t.text('maturity_date').notNullable(); // YYYY-MM-DD
    t.text('status').notNullable().defaultTo('active');
    // active | matured | withdrawn
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw('CREATE INDEX idx_savings_institution ON savings_instruments (institution_id)');
  await knex.raw('CREATE INDEX idx_savings_maturity ON savings_instruments (maturity_date)');
  await knex.raw('CREATE INDEX idx_savings_status ON savings_instruments (status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('savings_instruments');
}
