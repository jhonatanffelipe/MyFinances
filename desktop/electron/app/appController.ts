import { app } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import WebSocket from 'ws';
import { AppSession, SUPABASE_AUTH_STORAGE_KEY, type AppSupabaseClient, type FetchLike } from '@myfinances/core';
import setupSql from '../../../supabase/setup.sql?raw';
import type { DeviceLinkView, InviteView } from '../../src/interfaces/AppBridge';
import { APP_CHANNELS } from '../../src/interfaces/AppBridge';
import { SafeStorageKeyValueStore } from '../connection/secureStore';
import { broadcast } from './ipcHelpers';
import { LocalDatabaseFile } from './localDatabase';
import { ElectronNetworkMonitor } from './networkMonitor';

function deviceName() {
  return os.hostname().replace(/\.local$/i, '').slice(0, 60) || 'Computador';
}

const toQr = (code: string) => QRCode.toDataURL(code, { margin: 1, width: 320, errorCorrectionLevel: 'M' });

/**
 * Processo main: monta o AppSession do core (conexão, sessão, banco local por usuário,
 * sync e Realtime) com as peças do Electron e repassa os eventos ao renderer por IPC.
 * Os handlers chamam o `session` direto; aqui ficam só o que é do desktop (QR em
 * imagem, SQL de instalação, ciclo de vida).
 */
export class AppController {
  private readonly secure = new SafeStorageKeyValueStore();
  private readonly network = new ElectronNetworkMonitor();
  readonly session = new AppSession({
    secure: this.secure,
    network: this.network,
    fetch: fetch as unknown as FetchLike,
    createClient: (connection) =>
      createClient(connection.url, connection.key, {
        auth: {
          storage: this.secure,
          storageKey: SUPABASE_AUTH_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        // Node 20 (Electron 33) não tem WebSocket global
        realtime: { transport: WebSocket as unknown as never },
      }) as unknown as AppSupabaseClient,
    openDatabase: (fileName) => LocalDatabaseFile.open(path.join(app.getPath('userData'), 'data', fileName)),
    device: { name: deviceName, platform: 'desktop' },
    watchPairingRequests: true,
    log: (message, err) => console.error(message, err),
  });

  constructor() {
    this.session.onState((state) => broadcast(APP_CHANNELS.STATE_CHANGED, state));
    this.session.onSyncStatus((status) => broadcast(APP_CHANNELS.SYNC_STATUS_CHANGED, status));
    this.session.onDataChanged((change) => broadcast(APP_CHANNELS.DATA_CHANGED, change));
    this.session.onPairingRequest((request) => broadcast(APP_CHANNELS.DEVICES_PAIRING_REQUEST, request));
  }

  init() {
    return this.session.init();
  }

  async dispose() {
    await this.session.dispose();
    this.network.dispose();
  }

  /** Core da família ativa (handlers de dados). */
  core() {
    return this.session.core();
  }

  getSetupSql(): string {
    return setupSql;
  }

  async createInvite(): Promise<InviteView> {
    const { code } = await this.session.createInvite();
    return { code, qrDataUrl: await toQr(code) };
  }

  async createDeviceLink(): Promise<DeviceLinkView> {
    const link = await this.session.createDeviceLink();
    return { ...link, qrDataUrl: await toQr(link.code) };
  }
}
