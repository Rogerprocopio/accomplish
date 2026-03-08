import { useState, useEffect, useCallback } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { WhatsAppAllowlistEntry, WhatsAppStatus } from '@accomplish_ai/agent-core/common';
import { Trash, Phone, PhoneDisconnect, PhonePlus, WifiHigh } from '@phosphor-icons/react';

function AllowlistCard({
  entry,
  onDelete,
}: {
  entry: WhatsAppAllowlistEntry;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <Phone className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-mono font-medium text-foreground truncate">
            +{entry.phoneNumber}
          </p>
          {entry.label && <p className="text-xs text-muted-foreground truncate">{entry.label}</p>}
        </div>
      </div>
      <button
        onClick={onDelete}
        title="Remover número"
        className="ml-3 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );
}

interface AddFormState {
  phoneNumber: string;
  label: string;
}

const EMPTY_FORM: AddFormState = { phoneNumber: '', label: '' };

export function WhatsAppPanel() {
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected');
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [allowlist, setAllowlist] = useState<WhatsAppAllowlistEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accomplish = getAccomplish();

  const loadAllowlist = useCallback(async () => {
    const list = await accomplish.whatsappGetAllowlist();
    setAllowlist(list);
  }, [accomplish]);

  const loadStatus = useCallback(async () => {
    const s = await accomplish.whatsappGetStatus();
    setStatus(s.status);
    setPhoneNumber(s.phoneNumber);
  }, [accomplish]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: load state on mount
    void loadStatus();
    void loadAllowlist();

    const unsubQR = accomplish.onWhatsAppQR?.((dataUrl) => {
      setQrDataUrl(dataUrl);
      setConnecting(false);
    });

    const unsubStatus = accomplish.onWhatsAppStatus?.((data) => {
      setStatus(data.status as WhatsAppStatus);
      setPhoneNumber(data.phoneNumber);
      if (data.status === 'connected') {
        setQrDataUrl(null);
      }
    });

    return () => {
      unsubQR?.();
      unsubStatus?.();
    };
  }, [accomplish, loadStatus, loadAllowlist]);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    setQrDataUrl(null);
    try {
      await accomplish.whatsappConnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await accomplish.whatsappDisconnect();
      setQrDataUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desconectar.');
    }
  };

  const handleAdd = async () => {
    const cleaned = form.phoneNumber.replace(/\D/g, '');
    if (!cleaned) {
      setFormError(
        'Informe um número de telefone válido (somente dígitos, com DDD e código do país).',
      );
      return;
    }

    setFormError(null);
    try {
      await accomplish.whatsappAddToAllowlist({
        phoneNumber: cleaned,
        label: form.label.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      await loadAllowlist();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao adicionar número.');
    }
  };

  const handleDelete = async (id: string) => {
    await accomplish.whatsappRemoveFromAllowlist(id);
    await loadAllowlist();
  };

  const statusColor = {
    disconnected: 'text-muted-foreground',
    connecting: 'text-warning',
    connected: 'text-green-500',
  }[status];

  const statusLabel = {
    disconnected: 'Desconectado',
    connecting: 'Aguardando QR Code…',
    connected: `Conectado${phoneNumber ? ` — +${phoneNumber}` : ''}`,
  }[status];

  return (
    <div className="space-y-6">
      {/* Connection section */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiHigh className={`h-4 w-4 ${statusColor}`} />
            <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
          </div>

          {status === 'disconnected' ? (
            <button
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <PhonePlus className="h-4 w-4" />
              {connecting ? 'Conectando…' : 'Conectar WhatsApp'}
            </button>
          ) : status === 'connecting' ? (
            <button
              onClick={() => void handleDisconnect()}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          ) : (
            <button
              onClick={() => void handleDisconnect()}
              className="flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <PhoneDisconnect className="h-4 w-4" />
              Desconectar
            </button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* QR Code */}
        {qrDataUrl && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-sm text-muted-foreground text-center">
              Abra o WhatsApp no seu celular e escaneie o QR code abaixo para conectar.
            </p>
            <div className="rounded-lg border border-border bg-white p-3 inline-block">
              <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-56 h-56" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              WhatsApp → Menu → Dispositivos conectados → Conectar um dispositivo
            </p>
          </div>
        )}

        {status === 'connecting' && !qrDataUrl && (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Gerando QR Code…</span>
          </div>
        )}
      </div>

      {/* Allowlist section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Números Permitidos</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Apenas mensagens destes números acionarão o agente.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddForm((v) => !v);
              setFormError(null);
              setForm(EMPTY_FORM);
            }}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0 ml-4"
          >
            <Phone className="h-4 w-4" />
            Adicionar número
          </button>
        </div>

        {showAddForm && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Novo número</h4>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div>
              <label className="text-xs text-muted-foreground">
                Número (com código do país e DDD) *
              </label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="5511999999999"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ex: 5511999999999 (55 = Brasil, 11 = SP, sem espaços ou hífens)
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Apelido (opcional)</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: João, Cliente VIP"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setForm(EMPTY_FORM);
                  setFormError(null);
                }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleAdd()}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}

        {allowlist.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum número na lista. Adicione números para que o agente responda via WhatsApp.
          </p>
        ) : (
          <div className="space-y-2">
            {allowlist.map((entry) => (
              <AllowlistCard
                key={entry.id}
                entry={entry}
                onDelete={() => void handleDelete(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
