import { useState, useEffect, useCallback } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { IntegratedService } from '@accomplish_ai/agent-core/common';
import { Trash, Key, PlugsConnected } from '@phosphor-icons/react';

interface RegisterFormState {
  description: string;
  apiKey: string;
}

const EMPTY_FORM: RegisterFormState = { description: '', apiKey: '' };

function ServiceCard({ service, onDelete }: { service: IntegratedService; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">{service.description}</span>
        </div>
        <button
          onClick={onDelete}
          title="Remover integração"
          className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        {service.apiKey.substring(0, 8)}
        {'*'.repeat(Math.min(service.apiKey.length - 8, 16))}
      </p>
    </div>
  );
}

export function IntegratedServicesPanel() {
  const [services, setServices] = useState<IntegratedService[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RegisterFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accomplish = getAccomplish();

  const loadServices = useCallback(async () => {
    const list = await accomplish.listIntegrations();
    setServices(list);
  }, [accomplish]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const handleRegister = async () => {
    if (!form.description.trim() || !form.apiKey.trim()) {
      setError('Preencha todos os campos.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await accomplish.registerIntegration({
        description: form.description.trim(),
        apiKey: form.apiKey.trim(),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar API Key.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await accomplish.deleteIntegration(id);
    await loadServices();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Salve API Keys para o modelo usar diretamente. Identifique cada chave com uma descrição.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0 ml-4"
        >
          <PlugsConnected className="h-4 w-4" />
          Adicionar API Key
        </button>
      </div>

      {/* Register Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Nova API Key</h4>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div>
            <label className="text-xs text-muted-foreground">Descrição *</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Notion API Key, Stripe Secret Key"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">API Key *</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-... ou Bearer token"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
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
              onClick={() => void handleRegister()}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Services List */}
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma API Key salva ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onDelete={() => void handleDelete(service.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
