import { useState, useEffect, useCallback } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type {
  WhatsAppStatus,
  WhatsAppPendingPairing,
  WhatsAppAuthorizedJid,
} from '@accomplish_ai/agent-core/common';
import {
  Trash,
  PhoneDisconnect,
  PhonePlus,
  WifiHigh,
  CheckCircle,
  XCircle,
  UserCircle,
  Clock,
} from '@phosphor-icons/react';

// ── Pending Pairing Card ──────────────────────────────────────────────────────

function PendingPairingCard({
  pairing,
  onApprove,
  onDeny,
}: {
  pairing: WhatsAppPendingPairing;
  onApprove: (label?: string) => void;
  onDeny: () => void;
}) {
  const [label, setLabel] = useState('');

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-warning shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-mono font-semibold text-foreground tracking-widest">
              {pairing.code}
            </p>
            <p className="text-xs text-muted-foreground truncate font-mono">{pairing.jid}</p>
          </div>
        </div>
      </div>

      <div>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Apelido (opcional, ex: João)"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onDeny}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
        >
          <XCircle className="h-4 w-4" />
          Recusar
        </button>
        <button
          onClick={() => onApprove(label.trim() || undefined)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <CheckCircle className="h-4 w-4" />
          Aprovar
        </button>
      </div>
    </div>
  );
}

// ── Authorized JID Card ───────────────────────────────────────────────────────

function AuthorizedJidCard({
  entry,
  onDelete,
}: {
  entry: WhatsAppAuthorizedJid;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <UserCircle className="h-4 w-4 text-green-500 shrink-0" />
        <div className="min-w-0">
          {entry.label && (
            <p className="text-sm font-medium text-foreground truncate">{entry.label}</p>
          )}
          <p className="text-xs text-muted-foreground font-mono truncate">{entry.jid}</p>
        </div>
      </div>
      <button
        onClick={onDelete}
        title="Revogar acesso"
        className="ml-3 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function WhatsAppPanel() {
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected');
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pendingPairings, setPendingPairings] = useState<WhatsAppPendingPairing[]>([]);
  const [authorizedJids, setAuthorizedJids] = useState<WhatsAppAuthorizedJid[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accomplish = getAccomplish();

  const loadPending = useCallback(async () => {
    const list = await accomplish.whatsappGetPendingPairings();
    setPendingPairings(list);
  }, [accomplish]);

  const loadAuthorized = useCallback(async () => {
    const list = await accomplish.whatsappGetAuthorizedJids();
    setAuthorizedJids(list);
  }, [accomplish]);

  const loadStatus = useCallback(async () => {
    const s = await accomplish.whatsappGetStatus();
    setStatus(s.status);
    setPhoneNumber(s.phoneNumber);
  }, [accomplish]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: load state on mount
    void loadStatus();
    void loadPending();
    void loadAuthorized();

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

    const unsubPairing = accomplish.onWhatsAppNewPairing?.(() => {
      void loadPending();
    });

    return () => {
      unsubQR?.();
      unsubStatus?.();
      unsubPairing?.();
    };
  }, [accomplish, loadStatus, loadPending, loadAuthorized]);

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

  const handleApprove = async (id: string, label?: string) => {
    try {
      await accomplish.whatsappApprovePairing({ id, label });
      await Promise.all([loadPending(), loadAuthorized()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar.');
    }
  };

  const handleDeny = async (id: string) => {
    try {
      await accomplish.whatsappDenyPairing(id);
      await loadPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao recusar.');
    }
  };

  const handleRemoveAuthorized = async (id: string) => {
    await accomplish.whatsappRemoveAuthorizedJid(id);
    await loadAuthorized();
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

      {/* Pending Pairings */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Verificações Pendentes
            {pendingPairings.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                {pendingPairings.length}
              </span>
            )}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quando alguém envia uma mensagem pela primeira vez, o sistema gera um código de
            verificação. Aprove ou recuse o acesso abaixo.
          </p>
        </div>

        {pendingPairings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma verificação pendente.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingPairings.map((p) => (
              <PendingPairingCard
                key={p.id}
                pairing={p}
                onApprove={(label) => void handleApprove(p.id, label)}
                onDeny={() => void handleDeny(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Authorized Contacts */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Contatos Autorizados</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mensagens destes contatos acionam o agente automaticamente.
          </p>
        </div>

        {authorizedJids.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum contato autorizado. Aprove uma verificação acima para adicionar.
          </p>
        ) : (
          <div className="space-y-2">
            {authorizedJids.map((entry) => (
              <AuthorizedJidCard
                key={entry.id}
                entry={entry}
                onDelete={() => void handleRemoveAuthorized(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
