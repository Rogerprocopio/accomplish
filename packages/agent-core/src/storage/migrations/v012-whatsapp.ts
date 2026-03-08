import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  version: 12,
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_allowlist (
        id TEXT PRIMARY KEY,
        phone_number TEXT NOT NULL UNIQUE,
        label TEXT,
        created_at TEXT NOT NULL
      )
    `);
  },
};
