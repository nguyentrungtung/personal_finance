import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('net_worth_snapshots', (t) => {
    t.increments('id').primary();
    t.text('snapshot_date').notNullable().unique(); // YYYY-MM-DD
    t.text('total_vnd').notNullable();
    t.text('metals_vnd').notNullable();
    t.text('markets_vnd').notNullable();
    t.text('liquidity_vnd').notNullable();
    t.text('real_estate_vnd').notNullable();
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  await knex.raw(
    'CREATE INDEX idx_snapshots_date ON net_worth_snapshots (snapshot_date DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('net_worth_snapshots');
}
