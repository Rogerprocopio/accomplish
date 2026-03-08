import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  version: 13,
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_pending_pairings (
        id TEXT PRIMARY KEY,
        jid TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS whatsapp_authorized_jids (
        id TEXT PRIMARY KEY,
        jid TEXT NOT NULL UNIQUE,
        label TEXT,
        created_at TEXT NOT NULL
      );
    `);
  },
};
