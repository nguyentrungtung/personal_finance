import type { Knex } from 'knex';

/**
 * Add regional configuration columns to settings:
 * - country_code: ISO 3166-1 alpha-2 (e.g. 'VN', 'US')
 * - date_format: display format string (e.g. 'DD/MM/YYYY')
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('settings', (t) => {
    t.text('country_code').nullable().defaultTo(null);
    t.text('date_format').notNullable().defaultTo('DD/MM/YYYY');
  });
}

export async function down(_knex: Knex): Promise<void> {
  // SQLite: no-op
}
