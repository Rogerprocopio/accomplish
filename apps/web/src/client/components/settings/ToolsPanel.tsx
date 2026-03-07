import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { CustomTool, CustomToolLanguage } from '@accomplish_ai/agent-core/common';
import { Trash, Plus, CheckCircle, WarningCircle, CircleNotch, Clock } from '@phosphor-icons/react';

function StatusBadge({ status }: { status: CustomTool['status'] }) {
  if (status === 'ready') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
        <CheckCircle className="h-3.5 w-3.5" />
        Pronto
      </span>
    );
  }
  if (status === 'setting_up') {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
        <CircleNotch className="h-3.5 w-3.5 animate-spin" />
        Configurando...
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive font-medium">
        <WarningCircle className="h-3.5 w-3.5" />
        Erro
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      Aguardando setup
    </span>
  );
}

interface CreateFormState {
  name: string;
  description: string;
  language: CustomToolLanguage;
  code: string;
  requirements: string;
}

const EMPTY_FORM: CreateFormState = {
  name: '',
  description: '',
  language: 'python',
  code: '',
  requirements: '',
};

const CODE_PLACEHOLDER: Record<CustomToolLanguage, string> = {
  python: `import sys

def main():
    args = sys.argv[1:]
    # Sua lógica aqui
    print("resultado")

if __name__ == "__main__":
    main()`,
  nodejs: `const args = process.argv.slice(2);
// Sua lógica aqui
console.log("resultado");`,
};

export function ToolsPanel() {
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accomplish = useMemo(() => getAccomplish(), []);

  const loadTools = useCallback(async () => {
    try {
      const list = await accomplish.listTools();
      setTools(list);
    } catch (err) {
      console.error('[ToolsPanel] Failed to load tools:', err);
    }
  }, [accomplish]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  // Poll while any tool is setting_up
  useEffect(() => {
    const hasSettingUp = tools.some(
      (t) => t.status === 'setting_up' || t.status === 'pending_setup',
    );
    if (hasSettingUp && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void loadTools();
      }, 2000);
    } else if (!hasSettingUp && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tools, loadTools]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.code.trim()) {
      setError('Preencha nome, descrição e código.');
      return;
    }
    // Validate name: no spaces, lowercase/underscore
    if (!/^[a-z0-9_]+$/.test(form.name.trim())) {
      setError('Nome deve conter apenas letras minúsculas, números e underscore (ex: send_email).');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await accomplish.createTool({
        name: form.name.trim(),
        description: form.description.trim(),
        language: form.language,
        code: form.code,
        requirements: form.requirements,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadTools();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tool.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await accomplish.deleteTool(id);
    await loadTools();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Scripts com ambiente virtual próprio. O agente os usa via linha de comando com argumentos.
        </p>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0 ml-4"
        >
          <Plus className="h-4 w-4" />
          Nova Tool
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Nova Tool</h4>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome * (snake_case)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex: send_email"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Linguagem *</label>
              <select
                value={form.language}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    language: e.target.value as CustomToolLanguage,
                    code: '',
                  }))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="python">Python</option>
                <option value="nodejs">Node.js</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Descrição * (o agente lê isso)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Envia um e-mail via SMTP. Args: destinatario assunto mensagem"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Código *</label>
            <textarea
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              rows={10}
              placeholder={CODE_PLACEHOLDER[form.language]}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Dependências (uma por linha —{' '}
              {form.language === 'python' ? 'pip packages' : 'npm packages'})
            </label>
            <textarea
              value={form.requirements}
              onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
              rows={3}
              placeholder={form.language === 'python' ? 'requests\npandas' : 'axios\nlodash'}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            O ambiente virtual é criado automaticamente após salvar.
          </p>

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
              {saving ? 'Salvando...' : 'Criar Tool'}
            </button>
          </div>
        </div>
      )}

      {/* Tools List */}
      {tools.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tool criada ainda.</p>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="rounded-lg border border-border bg-background p-3 space-y-1.5"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-foreground">
                      {tool.name}
                    </span>
                    <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                      {tool.language === 'python' ? 'Python' : 'Node.js'}
                    </span>
                    <StatusBadge status={tool.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                  {tool.status === 'error' && tool.errorMessage && (
                    <p className="text-xs text-destructive font-mono">{tool.errorMessage}</p>
                  )}
                </div>
                <button
                  onClick={() => void handleDelete(tool.id)}
                  title="Remover tool"
                  className="ml-3 shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
