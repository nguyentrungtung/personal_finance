import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('institutions', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable().unique();
    t.text('type').notNullable(); // bank | broker | exchange | other
    t.text('archived_at');
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('institutions');
}
