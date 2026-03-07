import type { IntegratedService } from '../../common/types/integration.js';
import { getDatabase } from '../database.js';

interface IntegratedServiceRow {
  id: string;
  description: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

function rowToIntegratedService(row: IntegratedServiceRow): IntegratedService {
  return {
    id: row.id,
    description: row.description,
    apiKey: row.api_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createIntegratedService(
  id: string,
  description: string,
  apiKey: string,
): IntegratedService {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO integrated_services (id, description, api_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       description = excluded.description,
       api_key = excluded.api_key,
       updated_at = excluded.updated_at`,
  ).run(id, description, apiKey, now, now);
  return { id, description, apiKey, createdAt: now, updatedAt: now };
}

export function getAllIntegratedServices(): IntegratedService[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM integrated_services ORDER BY created_at ASC')
    .all() as IntegratedServiceRow[];
  return rows.map(rowToIntegratedService);
}

export function getIntegratedServiceById(id: string): IntegratedService | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM integrated_services WHERE id = ?').get(id) as
    | IntegratedServiceRow
    | undefined;
  return row ? rowToIntegratedService(row) : null;
}

export function deleteIntegratedService(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM integrated_services WHERE id = ?').run(id);
}
