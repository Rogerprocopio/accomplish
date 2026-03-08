export type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected';

export interface WhatsAppAllowlistEntry {
  id: string;
  phoneNumber: string;
  label?: string;
  createdAt: string;
}

export interface WhatsAppState {
  status: WhatsAppStatus;
  phoneNumber?: string;
  allowlist: WhatsAppAllowlistEntry[];
}
