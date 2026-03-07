import { useState, useEffect, useCallback } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { ScheduledTask } from '@accomplish_ai/agent-core/common';
import { Trash, CalendarPlus } from '@phosphor-icons/react';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: ScheduledTask['status'] }) {
  const colors: Record<ScheduledTask['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}

interface CreateFormState {
  title: string;
  description: string;
  action: string;
  date: string;
  time: string;
}

const EMPTY_FORM: CreateFormState = {
  title: '',
  description: '',
  action: '',
  date: '',
  time: '',
};

export function ScheduledTasksPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accomplish = getAccomplish();

  const loadTasks = useCallback(async () => {
    const taskList = await accomplish.listScheduledTasks();
    setTasks(taskList);
  }, [accomplish]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.action.trim() || !form.date || !form.time) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
    setSaving(true);
    setError(null);
    try {
      await accomplish.createScheduledTask({
        title: form.title.trim(),
        description: form.description.trim(),
        action: form.action.trim(),
        scheduledAt,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tarefa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    await accomplish.deleteScheduledTask(taskId);
    await loadTasks();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Agende tarefas para execução automática em uma data e hora específica.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <CalendarPlus className="h-4 w-4" />
          Nova Tarefa
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Agendar Nova Tarefa</h4>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Relatório semanal"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Descrição</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição opcional"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Ação / Prompt *</label>
            <textarea
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              rows={3}
              placeholder="Ex: Crie um relatório com as tarefas concluídas desta semana e salve em /relatorios"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Data *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hora *</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
                setError(null);
              }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Agendar'}
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma tarefa agendada ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start justify-between rounded-lg border border-border bg-background p-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                  <StatusBadge status={task.status} />
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                )}
                <p className="text-xs text-muted-foreground font-mono truncate">{task.action}</p>
                <p className="text-xs text-muted-foreground">
                  Agendado para: {formatDateTime(task.scheduledAt)}
                </p>
              </div>
              <button
                onClick={() => void handleDelete(task.id)}
                className="ml-3 shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
