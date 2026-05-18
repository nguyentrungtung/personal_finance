import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('scheduled_jobs', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable();
    t.text('job_type').notNullable(); // 'calendar_reminder' | 'data_cleanup' | 'nightly_summary'
    t.text('cron_expression').notNullable(); // e.g. '30 8 * * *'
    t.integer('enabled').notNullable().defaultTo(0);
    t.text('last_run_at');
    t.text('last_run_status'); // 'ok' | 'error'
    t.text('last_run_log');
    t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scheduled_jobs');
}
