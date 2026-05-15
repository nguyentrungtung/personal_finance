import type { Knex } from 'knex';

/**
 * Add source tracking columns to ledger_entries.
 *
 * source_module: which module auto-generated this entry
 *   'manual' | 'metals' | 'savings' | 'loans' | 'investment'
 *
 * source_id: the primary key in the originating table (metals_holdings.id, etc.)
 *   NULL for manually created entries.
 *
 * is_auto: 1 = auto-generated (readonly in UI), 0 = user created
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ledger_entries', (t) => {
    t.text('source_module').notNullable().defaultTo('manual');
    t.integer('source_id').nullable();
    t.integer('is_auto').notNullable().defaultTo(0);
  });

  // Index for fast reverse-lookup (find ledger entry from source record)
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_ledger_source ON ledger_entries (source_module, source_id)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_ledger_source');
  // SQLite doesn't support DROP COLUMN on older versions — recreate table approach not needed here
  // since we only add columns, rollback just removes the index
}
