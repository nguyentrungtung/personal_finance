import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.text('email').notNullable().unique();
    t.text('password_hash').notNullable();
    t.text('full_name').notNullable();
    t.text('professional_title');
    t.text('avatar_path');
    t.text('totp_secret');
    t.integer('totp_enabled').notNullable().defaultTo(0);
    t.text('totp_recovery_codes').defaultTo('[]');
    t.integer('failed_login_attempts').notNullable().defaultTo(0);
    t.text('locked_until');
    t.integer('token_version').notNullable().defaultTo(0);
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
