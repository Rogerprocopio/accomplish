import { getDatabase } from '../database.js';
import type { WhatsAppAllowlistEntry } from '../../common/types/whatsapp.js';

interface WhatsAppAllowlistRow {
  id: string;
  phone_number: string;
  label: string | null;
  created_at: string;
}

function rowToEntry(row: WhatsAppAllowlistRow): WhatsAppAllowlistEntry {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    label: row.label ?? undefined,
    createdAt: row.created_at,
  };
}

export function getWhatsAppAllowlist(): WhatsAppAllowlistEntry[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM whatsapp_allowlist ORDER BY created_at ASC')
    .all() as WhatsAppAllowlistRow[];
  return rows.map(rowToEntry);
}

export function addToWhatsAppAllowlist(
  id: string,
  phoneNumber: string,
  label?: string,
): WhatsAppAllowlistEntry {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR IGNORE INTO whatsapp_allowlist (id, phone_number, label, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, phoneNumber, label ?? null, now);
  return { id, phoneNumber, label, createdAt: now };
}

export function removeFromWhatsAppAllowlist(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM whatsapp_allowlist WHERE id = ?').run(id);
}

export function isPhoneNumberAllowed(phoneNumber: string): boolean {
  const db = getDatabase();
  const row = db
    .prepare('SELECT id FROM whatsapp_allowlist WHERE phone_number = ?')
    .get(phoneNumber);
  return !!row;
}
