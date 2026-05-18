import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('smtp_config', (t) => {
    t.integer('id').primary().defaultTo(1);
    t.text('provider').notNullable().defaultTo('gmail'); // 'gmail' | 'custom'
    t.text('host');                // null when provider='gmail'
    t.integer('port');
    t.integer('secure').notNullable().defaultTo(1); // 1=TLS, 0=STARTTLS
    t.text('user');
    t.text('password');
    t.text('from_name').notNullable().defaultTo('Courtify');
    t.text('from_email');
    t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
  });

  // Insert singleton row
  await knex('smtp_config').insert({ id: 1 });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('smtp_config');
}
