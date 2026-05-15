import knex from 'knex';
import knexConfig from './infrastructure/db/knexfile.js';
import { getDb } from './infrastructure/db/client.js';
import { runSeed } from './infrastructure/db/seed.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 5000);

async function start() {
  // Run migrations
  const db = knex(knexConfig);
  await db.migrate.latest();
  await db.destroy();

  const sqlite = getDb();

  // Auto-seed on first boot (empty DB): populates demo data + initial user.
  // Set INIT_SEED=false to skip.
  const isEmpty = !sqlite.prepare('SELECT id FROM institutions LIMIT 1').get();
  const skipSeed = process.env.INIT_SEED === 'false';
  if (isEmpty && !skipSeed) {
    await runSeed(sqlite);
  }

  const app = createApp();

  // Skip listening when imported by tests (supertest handles its own server)
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.warn(`[server] Listening on port ${PORT}`);
    });
  }

  return app;
}

start().catch((err: unknown) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});

export { start };
