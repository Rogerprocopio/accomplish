import type {
  CustomTool,
  CustomToolStatus,
  CreateCustomToolInput,
} from '../../common/types/customTool.js';
import { getDatabase } from '../database.js';

interface CustomToolRow {
  id: string;
  name: string;
  description: string;
  language: string;
  code: string;
  requirements: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCustomTool(row: CustomToolRow): CustomTool {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    language: row.language as CustomTool['language'],
    code: row.code,
    requirements: row.requirements,
    status: row.status as CustomToolStatus,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCustomTool(id: string, input: CreateCustomToolInput): CustomTool {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO custom_tools (id, name, description, language, code, requirements, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending_setup', ?, ?)`,
  ).run(
    id,
    input.name,
    input.description,
    input.language,
    input.code,
    input.requirements,
    now,
    now,
  );
  return {
    id,
    name: input.name,
    description: input.description,
    language: input.language,
    code: input.code,
    requirements: input.requirements,
    status: 'pending_setup',
    createdAt: now,
    updatedAt: now,
  };
}

export function getAllCustomTools(): CustomTool[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM custom_tools ORDER BY created_at ASC')
    .all() as CustomToolRow[];
  return rows.map(rowToCustomTool);
}

export function getCustomToolById(id: string): CustomTool | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM custom_tools WHERE id = ?').get(id) as
    | CustomToolRow
    | undefined;
  return row ? rowToCustomTool(row) : null;
}

export function updateCustomToolStatus(
  id: string,
  status: CustomToolStatus,
  errorMessage?: string,
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE custom_tools SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`,
  ).run(status, errorMessage ?? null, now, id);
}

export function deleteCustomTool(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM custom_tools WHERE id = ?').run(id);
}
