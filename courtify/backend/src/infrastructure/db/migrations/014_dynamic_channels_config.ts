import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add asset_subtypes_config to settings
  await knex.schema.alterTable('settings', (t) => {
    t.text('asset_subtypes_config').notNullable().defaultTo(
      JSON.stringify({
        markets: ['stock', 'crypto', 'mutual_fund', 'etf'],
        metals: ['gold', 'silver'],
        liquidity: ['mutual_fund', 'etf', 'other'],
        real_estate: ['real_estate', 'other']
      })
    );
  });

  // Add supported_channels to institutions
  await knex.schema.alterTable('institutions', (t) => {
    t.text('supported_channels').notNullable().defaultTo('[]');
  });

  // Seed default supported_channels based on existing 'type'
  // Bank -> liquidity
  // Brokerage -> markets
  // Crypto Exchange -> markets
  // Other -> real_estate, other
  await knex.raw(`
    UPDATE institutions
    SET supported_channels = CASE
      WHEN type = 'bank' THEN '["liquidity"]'
      WHEN type = 'brokerage' OR type = 'crypto_exchange' THEN '["markets"]'
      ELSE '["real_estate", "liquidity", "markets", "metals"]'
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('settings', (t) => {
    t.dropColumn('asset_subtypes_config');
  });

  await knex.schema.alterTable('institutions', (t) => {
    t.dropColumn('supported_channels');
  });
}
