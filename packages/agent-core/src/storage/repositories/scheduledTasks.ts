import type {
  ScheduledTask,
  ScheduledTaskStatus,
  CreateScheduledTaskInput,
  HeartbeatLog,
} from '../../common/types/scheduling.js';
import { getDatabase } from '../database.js';

interface ScheduledTaskRow {
  id: string;
  title: string;
  description: string;
  action: string;
  scheduled_at: string;
  status: string;
  result: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

interface HeartbeatLogRow {
  id: string;
  timestamp: string;
  status: string;
  tasks_executed: number;
  details: string | null;
}

function rowToScheduledTask(row: ScheduledTaskRow): ScheduledTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    action: row.action,
    scheduledAt: row.scheduled_at,
    status: row.status as ScheduledTaskStatus,
    result: row.result ?? undefined,
    taskId: row.task_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHeartbeatLog(row: HeartbeatLogRow): HeartbeatLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    status: row.status as HeartbeatLog['status'],
    tasksExecuted: row.tasks_executed,
    details: row.details ?? undefined,
  };
}

export function createScheduledTask(id: string, input: CreateScheduledTaskInput): ScheduledTask {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO scheduled_tasks (id, title, description, action, scheduled_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(id, input.title, input.description, input.action, input.scheduledAt, now, now);
  return {
    id,
    title: input.title,
    description: input.description,
    action: input.action,
    scheduledAt: input.scheduledAt,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

export function getAllScheduledTasks(): ScheduledTask[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM scheduled_tasks ORDER BY scheduled_at ASC')
    .all() as ScheduledTaskRow[];
  return rows.map(rowToScheduledTask);
}

export function getPendingDueTasks(now: string): ScheduledTask[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM scheduled_tasks WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC`,
    )
    .all(now) as ScheduledTaskRow[];
  return rows.map(rowToScheduledTask);
}

export function updateScheduledTaskStatus(
  id: string,
  status: ScheduledTaskStatus,
  result?: string,
  taskId?: string,
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE scheduled_tasks SET status = ?, result = ?, task_id = ?, updated_at = ? WHERE id = ?`,
  ).run(status, result ?? null, taskId ?? null, now, id);
}

export function deleteScheduledTask(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
}

export function insertHeartbeatLog(
  id: string,
  status: HeartbeatLog['status'],
  tasksExecuted: number,
  details?: string,
): HeartbeatLog {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  db.prepare(
    `INSERT INTO heartbeat_logs (id, timestamp, status, tasks_executed, details) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, timestamp, status, tasksExecuted, details ?? null);

  // Keep only the last 500 heartbeat entries to avoid unbounded growth
  db.prepare(
    `DELETE FROM heartbeat_logs WHERE id NOT IN (SELECT id FROM heartbeat_logs ORDER BY timestamp DESC LIMIT 500)`,
  ).run();

  return { id, timestamp, status, tasksExecuted, details };
}

export function getHeartbeatLogs(limit = 50): HeartbeatLog[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM heartbeat_logs ORDER BY timestamp DESC LIMIT ?')
    .all(limit) as HeartbeatLogRow[];
  return rows.map(rowToHeartbeatLog);
}
