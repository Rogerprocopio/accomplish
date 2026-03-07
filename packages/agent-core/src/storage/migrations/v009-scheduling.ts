import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  version: 9,
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE scheduled_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        action TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        result TEXT,
        task_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.exec(`CREATE INDEX idx_scheduled_tasks_status ON scheduled_tasks(status)`);
    db.exec(`CREATE INDEX idx_scheduled_tasks_scheduled_at ON scheduled_tasks(scheduled_at)`);

    db.exec(`
      CREATE TABLE heartbeat_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('heartbeat_ok', 'tasks_executed')),
        tasks_executed INTEGER NOT NULL DEFAULT 0,
        details TEXT
      )
    `);

    db.exec(`CREATE INDEX idx_heartbeat_logs_timestamp ON heartbeat_logs(timestamp)`);

    db.exec(`
      CREATE TABLE integrated_services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        base_url TEXT NOT NULL,
        api_key_ref TEXT NOT NULL,
        doc_path TEXT NOT NULL,
        endpoints TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  },
};
