import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('loans', (t) => {
    t.text('interest_rate'); // Stored as string to match principal/amount pattern
    t.text('interest_type'); // 'percentage' | 'fixed'
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('loans', (t) => {
    t.dropColumn('interest_rate');
    t.dropColumn('interest_type');
  });
}
