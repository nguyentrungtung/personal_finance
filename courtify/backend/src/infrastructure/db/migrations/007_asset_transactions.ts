import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('asset_transactions', (t) => {
    t.increments('id').primary();
    t.integer('lot_id').notNullable().references('id').inTable('asset_lots');
    t.text('transaction_type').notNullable(); // buy | sell | dividend | split
    t.text('transaction_date').notNullable(); // YYYY-MM-DD
    t.text('volume').notNullable();
    t.text('price_per_unit').notNullable();
    t.text('fee').notNullable().defaultTo('0.0000');
    t.text('net_amount').notNullable(); // signed VND cash flow
    t.text('realized_pnl'); // non-null on SELL
    t.text('notes');
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    // No updated_at — immutable append-only log
  });

  await knex.raw('CREATE INDEX idx_atx_lot ON asset_transactions (lot_id)');
  await knex.raw('CREATE INDEX idx_atx_type ON asset_transactions (transaction_type)');
  await knex.raw(
    'CREATE INDEX idx_atx_date ON asset_transactions (transaction_date DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('asset_transactions');
}
