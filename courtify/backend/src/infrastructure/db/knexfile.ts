import type { Knex } from 'knex';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.resolve(import.meta.dirname, '../../../data/courtify.db');

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: {
    filename: DB_PATH,
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(import.meta.dirname, 'migrations'),
    loadExtensions: ['.js', '.ts'],
  },
  pool: {
    afterCreate(db: Database.Database, done: (err: Error | null) => void) {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');
      done(null);
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
type Database = import('better-sqlite3').Database;

export default config;
