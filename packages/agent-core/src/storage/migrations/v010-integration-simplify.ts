import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  version: 10,
  up: (db: Database) => {
    db.exec(`DROP TABLE IF EXISTS integrated_services`);

    db.exec(`
      CREATE TABLE integrated_services (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        api_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  },
};
