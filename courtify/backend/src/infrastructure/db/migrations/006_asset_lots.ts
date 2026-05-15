import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('asset_lots', (t) => {
    t.increments('id').primary();
    t.integer('asset_class_id').notNullable().references('id').inTable('asset_classes');
    t.text('asset_name').notNullable();
    t.text('asset_subtype').notNullable(); // stock | crypto | mutual_fund | etf
    t.integer('institution_id').references('id').inTable('institutions');
    t.text('purchase_date').notNullable(); // YYYY-MM-DD
    t.text('original_volume').notNullable();
    t.text('remaining_volume').notNullable();
    t.text('buy_price_per_unit').notNullable();
    t.text('current_price_per_unit').notNullable();
    t.text('unit_label').notNullable().defaultTo('shares');
    t.text('status').notNullable().defaultTo('active');
    // active | partial_closed | closed
    t.text('notes');
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw('CREATE INDEX idx_lots_asset_class ON asset_lots (asset_class_id)');
  await knex.raw('CREATE INDEX idx_lots_asset_name ON asset_lots (asset_name)');
  await knex.raw('CREATE INDEX idx_lots_status ON asset_lots (status)');
  await knex.raw('CREATE INDEX idx_lots_purchase_date ON asset_lots (purchase_date ASC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('asset_lots');
}
