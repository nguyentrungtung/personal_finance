import type { Knex } from 'knex';

/**
 * Two additions for accounting correctness:
 *
 * 1. reversal_of (ledger_entries)
 *    Links a reversal entry back to the original entry it cancels.
 *    When an entry with status='completed' needs correction, the workflow is:
 *      a) Create a mirror entry (same fields, negated amount) → reversal entry
 *      b) Mark the original as status='reversed'
 *      c) Create a new corrected entry
 *    Three rows persist forever. Net effect = only the corrected amount counts.
 *
 * 2. ledger_entry_versions
 *    Snapshots the full row before every PUT /:id edit.
 *    Allows auditors to see what was changed, when, and with what reason.
 *    Never deleted — append-only audit log.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. reversal_of column
  await knex.schema.alterTable('ledger_entries', (t) => {
    t.integer('reversal_of').nullable().references('id').inTable('ledger_entries');
  });

  // 2. edit-history table
  await knex.schema.createTable('ledger_entry_versions', (t) => {
    t.increments('id');
    t.integer('entry_id').notNullable().references('id').inTable('ledger_entries');
    t.integer('version').notNullable();          // 1-based, increments per entry
    t.text('snapshot').notNullable();            // JSON snapshot of the row before edit
    t.text('edit_reason').nullable();            // optional reason supplied by user
    t.text('changed_at').notNullable();
  });

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_lev_entry ON ledger_entry_versions (entry_id)'
  );

  // Index for fast lookup of reversal chains
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_le_reversal ON ledger_entries (reversal_of)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_lev_entry');
  await knex.raw('DROP INDEX IF EXISTS idx_le_reversal');
  await knex.schema.dropTableIfExists('ledger_entry_versions');
  // SQLite: reversal_of column cannot be dropped — intentionally non-reversible
}
