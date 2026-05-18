import type { Knex } from 'knex';

/**
 * Add void support to ledger_entries.
 *
 * Voiding is the correct accounting practice for correcting errors —
 * instead of deleting a record, we mark it as voided so the audit trail
 * is preserved. Voided entries are excluded from all balance calculations
 * but remain visible in the ledger with a 'voided' status badge.
 *
 * voided_at:    timestamp when the entry was voided
 * void_reason:  mandatory explanation from the user (e.g. "Wrong amount entered")
 *
 * Note: 'voided' is added as a valid status value alongside the existing
 * completed | pending | appraisal | cleared values.
 * SQLite uses TEXT for status so no ALTER TYPE needed.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('ledger_entries', (t) => {
    t.text('voided_at').nullable();
    t.text('void_reason').nullable();
  });

  // Index for fast filtering of non-voided entries (most common query)
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_ledger_voided ON ledger_entries (voided_at)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_ledger_voided');
  // SQLite: columns cannot be dropped — migration is intentionally non-reversible
}
