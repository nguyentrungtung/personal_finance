import type { Knex } from 'knex';

/**
 * Add notification_emails column to settings.
 * Stores a JSON array of email strings for external alert delivery.
 * e.g. '["user@gmail.com", "team@company.com"]'
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('settings', (t) => {
    t.text('notification_emails').notNullable().defaultTo('[]');
  });
}

export async function down(knex: Knex): Promise<void> {
  // SQLite doesn't support DROP COLUMN on older versions — no-op
}
