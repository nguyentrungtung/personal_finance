import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('metals_holdings', (t) => {
    t.increments('id').primary();
    t.text('metal_type').notNullable(); // gold | silver
    t.text('label');
    t.text('weight_grams').notNullable(); // canonical stored unit
    t.text('weight_display').notNullable(); // original input
    t.text('weight_unit').notNullable(); // chi | luong | gram
    t.text('purity').notNullable(); // e.g. "99.9900"
    t.text('purchase_price_per_gram').notNullable();
    t.text('current_price_per_gram').notNullable();
    t.text('purchase_date').notNullable(); // YYYY-MM-DD
    t.integer('institution_id').references('id').inTable('institutions');
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw('CREATE INDEX idx_metals_type ON metals_holdings (metal_type)');
  await knex.raw('CREATE INDEX idx_metals_purchase_date ON metals_holdings (purchase_date)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('metals_holdings');
}
