import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAccomplish } from '@/lib/accomplish';
import { FolderOpen, Brain, FileText, ArrowSquareOut } from '@phosphor-icons/react';

export function WorkspacePanel() {
  const { t } = useTranslation('settings');
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const accomplish = useMemo(() => getAccomplish(), []);

  useEffect(() => {
    accomplish
      .getWorkspacePath()
      .then(setWorkspacePath)
      .catch(() => setWorkspacePath(null))
      .finally(() => setLoading(false));
  }, [accomplish]);

  const handleOpen = async () => {
    await accomplish.openWorkspace();
  };

  return (
    <div className="space-y-6">
      {/* Path card */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">{t('workspace.location')}</span>
        </div>
        {loading ? (
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-xs font-mono text-muted-foreground break-all">{workspacePath}</p>
        )}
        <button
          onClick={() => void handleOpen()}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <ArrowSquareOut className="h-4 w-4" />
          {t('workspace.openFolder')}
        </button>
      </div>

      {/* context/ explanation */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-foreground">context/</span>
        </div>
        <p className="text-sm text-muted-foreground">{t('workspace.contextDescription')}</p>
        <p className="text-xs text-muted-foreground italic">{t('workspace.contextHint')}</p>
      </div>

      {/* memory/ explanation */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500 shrink-0" />
          <span className="text-sm font-medium text-foreground">memory/</span>
        </div>
        <p className="text-sm text-muted-foreground">{t('workspace.memoryDescription')}</p>
        <p className="text-xs text-muted-foreground italic">{t('workspace.memoryHint')}</p>
      </div>
    </div>
  );
}
