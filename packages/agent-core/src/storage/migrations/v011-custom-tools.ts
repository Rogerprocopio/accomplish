import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  version: 11,
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE custom_tools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('python', 'nodejs')),
        code TEXT NOT NULL,
        requirements TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending_setup' CHECK (status IN ('pending_setup', 'setting_up', 'ready', 'error')),
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  },
};
