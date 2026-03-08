import path from 'path';
import fs from 'fs';
import { createTaskId } from '@accomplish_ai/agent-core';
import { getTaskManager } from '../opencode';
import { getStorage } from '../store/storage';
import type { TaskCallbacks } from '../opencode';
import { isPhoneNumberAllowed } from '@accomplish_ai/agent-core/storage/repositories/whatsapp';
import type { WhatsAppStatus } from '@accomplish_ai/agent-core/common';
import type { BrowserWindow } from 'electron';
import type { TaskMessage } from '@accomplish_ai/agent-core';

type SendToRenderer = (channel: string, ...args: unknown[]) => void;

let _sendToRenderer: SendToRenderer | null = null;
let _status: WhatsAppStatus = 'disconnected';
let _phoneNumber: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sock: any = null;
let _sessionDir = '';
let _userDataPath = '';

export function initWhatsApp(mainWindow: BrowserWindow, userDataPath: string): void {
  _userDataPath = userDataPath;
  _sendToRenderer = (channel, ...args) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  };
}

export function getWhatsAppStatus(): { status: WhatsAppStatus; phoneNumber?: string } {
  return { status: _status, phoneNumber: _phoneNumber };
}

function setStatus(status: WhatsAppStatus, phoneNumber?: string): void {
  _status = status;
  _phoneNumber = phoneNumber;
  _sendToRenderer?.('whatsapp:status', { status, phoneNumber });
}

function extractText(message: {
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
  };
}): string {
  return (
    message.message?.conversation ??
    message.message?.extendedTextMessage?.text ??
    message.message?.imageMessage?.caption ??
    ''
  );
}

function extractPhoneNumber(jid: string): string {
  return jid.split('@')[0].split(':')[0];
}

async function processIncomingMessage(
  sender: string,
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock: any,
): Promise<void> {
  const phoneNumber = extractPhoneNumber(sender);

  if (!isPhoneNumberAllowed(phoneNumber)) {
    console.log(`[WhatsApp] Message from non-allowed number ${phoneNumber} — ignored`);
    return;
  }

  console.log(`[WhatsApp] Processing message from ${phoneNumber}: ${text.substring(0, 80)}…`);

  const taskId = createTaskId();
  const storage = getStorage();
  const taskManager = getTaskManager();
  const assistantMessages: string[] = [];

  const callbacks: TaskCallbacks = {
    onBatchedMessages: (messages: TaskMessage[]) => {
      for (const msg of messages) {
        storage.addTaskMessage(taskId, msg);
        if (msg.type === 'assistant' && msg.content) {
          assistantMessages.push(msg.content);
        }
      }
    },
    onProgress: () => undefined,
    onPermissionRequest: () => undefined,
    onComplete: () => {
      const reply = assistantMessages[assistantMessages.length - 1];
      if (reply) {
        void sock.sendMessage(sender, { text: reply }).catch((err: Error) => {
          console.error('[WhatsApp] Failed to send reply:', err);
        });
      }
    },
    onError: (err: Error) => {
      console.error('[WhatsApp] Task error:', err.message);
      storage.updateTaskStatus(taskId, 'failed', new Date().toISOString());
    },
    onStatusChange: (status) => {
      storage.updateTaskStatus(taskId, status, new Date().toISOString());
    },
    onTodoUpdate: () => undefined,
    onAuthError: () => undefined,
    onToolCallComplete: () => undefined,
  };

  try {
    const task = await taskManager.startTask(taskId, { prompt: text }, callbacks);
    storage.saveTask(task);
    console.log(`[WhatsApp] Task ${task.id} started for sender ${phoneNumber}`);
  } catch (err) {
    console.error('[WhatsApp] Failed to start task:', err);
  }
}

export async function connectWhatsApp(): Promise<void> {
  if (_status === 'connecting' || _status === 'connected') {
    return;
  }

  if (!_userDataPath) {
    throw new Error('WhatsApp service not initialized — call initWhatsApp first');
  }

  _sessionDir = path.join(_userDataPath, 'whatsapp-session');

  // Remove any leftover partial session from a previous failed attempt
  // (files that were written before QR was scanned can cause 405 rejections)
  const credFile = path.join(_sessionDir, 'creds.json');
  if (!fs.existsSync(credFile) && fs.existsSync(_sessionDir)) {
    fs.rmSync(_sessionDir, { recursive: true, force: true });
    console.log('[WhatsApp] Cleared incomplete session directory before connecting');
  }

  fs.mkdirSync(_sessionDir, { recursive: true });
  setStatus('connecting');

  try {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

    // Always fetch the latest WA Web version — using an outdated version causes 405 rejections
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] Using WA version ${version.join('.')}, isLatest=${isLatest}`);

    const { state, saveCreds } = await useMultiFileAuthState(_sessionDir);

    const QRCode = await import('qrcode');

    const noop = () => undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const silentLogger: any = {
      level: 'silent',
      trace: noop,
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
      fatal: noop,
      child: () => silentLogger,
    };

    const sock = makeWASocket({
      version,
      auth: state,
      // Generic browser fingerprint — avoids platform-specific WA rejections
      browser: ['Accomplish', 'Chrome', '110.0.0'],
      printQRInTerminal: false,
      syncFullHistory: false,
      logger: silentLogger,
    });

    _sock = sock;

    sock.ev.on(
      'connection.update',
      async (update: {
        connection?: string;
        lastDisconnect?: { error?: unknown };
        qr?: string;
      }) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const dataUrl = await QRCode.default.toDataURL(qr, { width: 300 });
            _sendToRenderer?.('whatsapp:qr', dataUrl);
            console.log('[WhatsApp] QR code generated and sent to renderer');
          } catch (err) {
            console.error('[WhatsApp] Failed to generate QR code:', err);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
            ?.statusCode;

          // 401 = logged out; 405 = session invalid/bad version (clear session, don't loop)
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isBadSession = statusCode === 405 || statusCode === DisconnectReason.badSession;
          const shouldReconnect = !isLoggedOut && !isBadSession;

          console.log(
            `[WhatsApp] Connection closed — statusCode: ${statusCode}, reconnect: ${shouldReconnect}`,
          );

          _sock = null;
          setStatus('disconnected');

          if (isLoggedOut || isBadSession) {
            // Clear corrupted or invalid session so next connect starts fresh with a new QR
            try {
              fs.rmSync(_sessionDir, { recursive: true, force: true });
              console.log('[WhatsApp] Session cleared (logout or bad session)');
            } catch {
              /* ignore */
            }
          } else if (shouldReconnect) {
            setTimeout(() => {
              if (_status === 'disconnected') {
                console.log('[WhatsApp] Attempting reconnect…');
                void connectWhatsApp().catch((err) =>
                  console.error('[WhatsApp] Reconnect failed:', err),
                );
              }
            }, 5000);
          }
        } else if (connection === 'open') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const phone = extractPhoneNumber((sock as any).user?.id ?? '');
          setStatus('connected', phone || undefined);
          console.log(`[WhatsApp] Connected as ${phone}`);
        }
      },
    );

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on(
      'messages.upsert',
      async ({
        messages,
        type,
      }: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: any[];
        type: string;
      }) => {
        if (type !== 'notify') {
          return;
        }

        for (const message of messages) {
          if (message.key?.fromMe) {
            continue;
          }

          const sender: string = message.key?.remoteJid ?? '';
          if (!sender) {
            continue;
          }

          // Skip group messages
          if (sender.endsWith('@g.us')) {
            continue;
          }

          const text = extractText(message);
          if (!text.trim()) {
            continue;
          }

          await processIncomingMessage(sender, text, sock);
        }
      },
    );
  } catch (err) {
    console.error('[WhatsApp] Failed to initialize connection:', err);
    _sock = null;
    setStatus('disconnected');
    throw err;
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  if (_sock) {
    try {
      await _sock.logout();
    } catch {
      try {
        _sock.end(new Error('Manual disconnect'));
      } catch {
        /* ignore */
      }
    }
    _sock = null;
  }

  setStatus('disconnected');

  if (_sessionDir && fs.existsSync(_sessionDir)) {
    try {
      fs.rmSync(_sessionDir, { recursive: true, force: true });
      console.log('[WhatsApp] Session cleared on disconnect');
    } catch {
      /* ignore */
    }
  }
}
