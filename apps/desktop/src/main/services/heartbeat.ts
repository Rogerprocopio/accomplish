import { randomUUID } from 'crypto';
import {
  getPendingDueTasks,
  updateScheduledTaskStatus,
  insertHeartbeatLog,
} from '@accomplish_ai/agent-core/storage/repositories/scheduledTasks';
import { getTaskManager } from '../opencode';
import { getStorage } from '../store/storage';
import { mapResultToStatus } from '@accomplish_ai/agent-core';
import type { TaskCallbacks } from '../opencode';

const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let _intervalId: ReturnType<typeof setInterval> | null = null;

function createHeartbeatCallbacks(taskId: string, scheduledTaskId: string): TaskCallbacks {
  const storage = getStorage();
  return {
    onBatchedMessages: (messages) => {
      for (const msg of messages) {
        storage.addTaskMessage(taskId, msg);
      }
    },
    onProgress: () => undefined,
    onPermissionRequest: () => undefined,
    onComplete: (result) => {
      const status = mapResultToStatus(result);
      storage.updateTaskStatus(taskId, status, new Date().toISOString());
      updateScheduledTaskStatus(
        scheduledTaskId,
        status === 'completed' ? 'completed' : 'failed',
        undefined,
        taskId,
      );
    },
    onError: (error) => {
      console.error('[Heartbeat] Task error:', error.message);
      storage.updateTaskStatus(taskId, 'failed', new Date().toISOString());
      updateScheduledTaskStatus(scheduledTaskId, 'failed', error.message, taskId);
    },
    onDebug: () => undefined,
    onStatusChange: (status) => {
      storage.updateTaskStatus(taskId, status, new Date().toISOString());
    },
    onTodoUpdate: () => undefined,
    onAuthError: () => undefined,
    onToolCallComplete: () => undefined,
  };
}

async function runHeartbeat(): Promise<void> {
  console.log('[Heartbeat] Running heartbeat check...');

  try {
    const now = new Date().toISOString();
    const dueTasks = getPendingDueTasks(now);

    if (dueTasks.length === 0) {
      insertHeartbeatLog(randomUUID(), 'heartbeat_ok', 0);
      console.log('[Heartbeat] heartbeat_ok — no pending tasks due');
      return;
    }

    console.log(`[Heartbeat] Found ${dueTasks.length} due task(s), executing...`);

    const taskManager = getTaskManager();
    const storage = getStorage();
    let executed = 0;

    for (const scheduledTask of dueTasks) {
      const taskId = randomUUID();
      try {
        updateScheduledTaskStatus(scheduledTask.id, 'running');

        const config = { prompt: scheduledTask.action };
        const callbacks = createHeartbeatCallbacks(taskId, scheduledTask.id);
        const task = await taskManager.startTask(taskId, config, callbacks);
        storage.saveTask(task);
        updateScheduledTaskStatus(scheduledTask.id, 'running', undefined, task.id);
        executed++;
        console.log(`[Heartbeat] Started task ${task.id} for scheduled task ${scheduledTask.id}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        updateScheduledTaskStatus(scheduledTask.id, 'failed', errorMsg, taskId);
        console.error(`[Heartbeat] Failed to execute scheduled task ${scheduledTask.id}:`, err);
      }
    }

    insertHeartbeatLog(
      randomUUID(),
      'tasks_executed',
      executed,
      JSON.stringify({ scheduledTaskIds: dueTasks.map((t) => t.id) }),
    );
  } catch (err) {
    console.error('[Heartbeat] Error during heartbeat run:', err);
  }
}

export function startHeartbeatService(): void {
  if (_intervalId !== null) {
    return;
  }

  // Run once shortly after startup (1 minute delay) to catch any missed tasks
  setTimeout(() => {
    void runHeartbeat();
  }, 60_000);

  _intervalId = setInterval(() => {
    void runHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);

  console.log('[Heartbeat] Service started — interval: 30 minutes');
}

export function stopHeartbeatService(): void {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
    console.log('[Heartbeat] Service stopped');
  }
}
