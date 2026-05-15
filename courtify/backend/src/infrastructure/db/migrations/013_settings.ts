import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('settings', (t) => {
    t.integer('id').primary().defaultTo(1);
    t.text('currency').notNullable().defaultTo('VND');
    t.text('notification_days_advance').notNullable().defaultTo('[1,7]');
    t.text('timezone').notNullable().defaultTo('Asia/Ho_Chi_Minh');
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  // Insert the single default settings row
  await knex('settings').insert({
    id: 1,
    currency: 'VND',
    notification_days_advance: '[1,7]',
    timezone: 'Asia/Ho_Chi_Minh',
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings');
}
