import type Database from 'better-sqlite3';
import type { CreateInstitutionDto } from './institutions.types.js';

export class InstitutionsRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(conditions: string[], params: (string | number)[]): Record<string, unknown>[] {
    let query = 'SELECT * FROM institutions';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY name ASC';
    return this.db.prepare(query).all(...params) as Record<string, unknown>[];
  }

  findById(id: number): Record<string, unknown> | undefined {
    return this.db.prepare('SELECT * FROM institutions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  create(data: CreateInstitutionDto): number {
    const result = this.db.prepare(
      'INSERT INTO institutions (name, type, supported_channels) VALUES (?, ?, ?)'
    ).run(data.name, data.type, data.supported_channels ?? '[]');
    return result.lastInsertRowid as number;
  }

  update(id: number, sets: string[], vals: (string | number | null)[]): void {
    this.db.prepare(`UPDATE institutions SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  }

  archive(id: number): void {
    this.db.prepare("UPDATE institutions SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
  }

  restore(id: number): void {
    this.db.prepare("UPDATE institutions SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
  }

  countReferences(table: string, col: string, id: number): number {
    return (this.db.prepare(`SELECT COUNT(*) AS cnt FROM ${table} WHERE ${col} = ?`).get(id) as { cnt: number }).cnt;
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM institutions WHERE id = ?').run(id);
  }
}
