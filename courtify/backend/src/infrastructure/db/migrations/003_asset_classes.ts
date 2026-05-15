import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('asset_classes', (t) => {
    t.increments('id').primary();
    t.text('code').notNullable().unique(); // metals | markets | liquidity | real_estate
    t.text('label').notNullable();
    t.text('icon');
  });

  // Seed rows
  await knex('asset_classes').insert([
    { code: 'metals', label: 'Metals', icon: 'gem' },
    { code: 'markets', label: 'Markets', icon: 'trending-up' },
    { code: 'liquidity', label: 'Liquidity', icon: 'banknote' },
    { code: 'real_estate', label: 'Real Estate', icon: 'building' },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('asset_classes');
}
