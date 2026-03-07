export type ScheduledTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  action: string;
  scheduledAt: string;
  status: ScheduledTaskStatus;
  result?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeartbeatLog {
  id: string;
  timestamp: string;
  status: 'heartbeat_ok' | 'tasks_executed';
  tasksExecuted: number;
  details?: string;
}

export interface CreateScheduledTaskInput {
  title: string;
  description: string;
  action: string;
  scheduledAt: string;
}
