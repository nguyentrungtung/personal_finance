import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.resolve(import.meta.dirname, '../../../data/courtify.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);

  // Enable WAL mode for concurrent reads
  _db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  _db.pragma('foreign_keys = ON');
  // Reduce lock wait failures under concurrent load
  _db.pragma('busy_timeout = 5000');

  return _db;
}

/** Close and reset the singleton — used in tests to get a fresh DB. */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export default getDb;
