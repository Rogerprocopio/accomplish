import { getDatabase } from '../database.js';
import type {
  WhatsAppAllowlistEntry,
  WhatsAppPendingPairing,
  WhatsAppAuthorizedJid,
} from '../../common/types/whatsapp.js';

// ── Legacy allowlist (phone number) ─────────────────────────────────────────

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

// ── Pending pairings ─────────────────────────────────────────────────────────

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface WhatsAppPendingPairingRow {
  id: string;
  jid: string;
  code: string;
  created_at: string;
}

function rowToPairing(row: WhatsAppPendingPairingRow): WhatsAppPendingPairing {
  return { id: row.id, jid: row.jid, code: row.code, createdAt: row.created_at };
}

export function createPendingPairing(
  id: string,
  jid: string,
  code: string,
): WhatsAppPendingPairing {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO whatsapp_pending_pairings (id, jid, code, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, jid, code, now);
  return { id, jid, code, createdAt: now };
}

export function getActivePendingPairing(jid: string): WhatsAppPendingPairing | null {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - PAIRING_TTL_MS).toISOString();
  const row = db
    .prepare('SELECT * FROM whatsapp_pending_pairings WHERE jid = ? AND created_at > ?')
    .get(jid, cutoff) as WhatsAppPendingPairingRow | undefined;
  return row ? rowToPairing(row) : null;
}

export function getAllActivePendingPairings(): WhatsAppPendingPairing[] {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - PAIRING_TTL_MS).toISOString();
  const rows = db
    .prepare(
      'SELECT * FROM whatsapp_pending_pairings WHERE created_at > ? ORDER BY created_at DESC',
    )
    .all(cutoff) as WhatsAppPendingPairingRow[];
  return rows.map(rowToPairing);
}

export function getPendingPairingById(id: string): WhatsAppPendingPairing | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM whatsapp_pending_pairings WHERE id = ?').get(id) as
    | WhatsAppPendingPairingRow
    | undefined;
  return row ? rowToPairing(row) : null;
}

export function deletePendingPairing(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM whatsapp_pending_pairings WHERE id = ?').run(id);
}

export function cleanupExpiredPairings(): void {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - PAIRING_TTL_MS).toISOString();
  db.prepare('DELETE FROM whatsapp_pending_pairings WHERE created_at <= ?').run(cutoff);
}

// ── Authorized JIDs ──────────────────────────────────────────────────────────

interface WhatsAppAuthorizedJidRow {
  id: string;
  jid: string;
  label: string | null;
  created_at: string;
}

function rowToAuthorized(row: WhatsAppAuthorizedJidRow): WhatsAppAuthorizedJid {
  return { id: row.id, jid: row.jid, label: row.label ?? undefined, createdAt: row.created_at };
}

export function addAuthorizedJid(id: string, jid: string, label?: string): WhatsAppAuthorizedJid {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO whatsapp_authorized_jids (id, jid, label, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, jid, label ?? null, now);
  return { id, jid, label, createdAt: now };
}

export function getAuthorizedJids(): WhatsAppAuthorizedJid[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM whatsapp_authorized_jids ORDER BY created_at ASC')
    .all() as WhatsAppAuthorizedJidRow[];
  return rows.map(rowToAuthorized);
}

export function isJidAuthorized(jid: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM whatsapp_authorized_jids WHERE jid = ?').get(jid);
  return !!row;
}

export function removeAuthorizedJid(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM whatsapp_authorized_jids WHERE id = ?').run(id);
}
