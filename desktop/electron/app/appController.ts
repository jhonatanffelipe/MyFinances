import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import initSqlJs, { type Database } from 'sql.js';
import WebSocket from 'ws';
import {
  AppError,
  AppSession,
  createSqlJsAdapter,
  SUPABASE_AUTH_STORAGE_KEY,
  type AppSupabaseClient,
  type FetchLike,
  type V1ImportReport,
} from '@myfinances/core';
import setupSql from '../../../supabase/setup.sql?raw';
import type { DeviceLinkView, InviteView, V1FileView } from '../../src/interfaces/AppBridge';
import { APP_CHANNELS } from '../../src/interfaces/AppBridge';
import { SafeStorageKeyValueStore } from '../connection/secureStore';
import { broadcast } from './ipcHelpers';
import { LocalDatabaseFile } from './localDatabase';
import { ElectronNetworkMonitor } from './networkMonitor';
import { getMainWindow } from '../window';

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

  /** Cópia em memória do banco da v1 escolhido (o arquivo original nunca é aberto para escrita). */
  private v1Source: Database | null = null;

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

  // ------------------------------------------------------------------ importar o banco da v1

  /** Escolhe o db_myfinances.sqlite da v1, abre uma CÓPIA em memória e devolve a prévia. */
  async selectV1File(): Promise<V1FileView | null> {
    const win = getMainWindow() ?? BrowserWindow.getFocusedWindow() ?? undefined;
    const options = {
      title: 'Escolha o banco do MyFinances v1 (db_myfinances.sqlite)',
      properties: ['openFile' as const],
      filters: [
        { name: 'Banco do MyFinances', extensions: ['sqlite', 'db'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    this.closeV1Source();
    const SQL = await initSqlJs();
    let db: Database;
    try {
      db = new SQL.Database(fs.readFileSync(filePath));
    } catch {
      throw AppError.validation('Não foi possível abrir o arquivo. Escolha o db_myfinances.sqlite da v1.');
    }
    try {
      const preview = await this.session.core().importV1.preview.execute(createSqlJsAdapter(db));
      this.v1Source = db;
      return { fileName: path.basename(filePath), preview };
    } catch (err) {
      db.close();
      throw err;
    }
  }

  async importV1(memberId: string | null): Promise<V1ImportReport> {
    if (!this.v1Source) throw AppError.validation('Escolha o arquivo da v1 primeiro');
    try {
      const report = await this.session.core().importV1.execute.execute(createSqlJsAdapter(this.v1Source), {
        memberId,
        onProgress: (p) => broadcast(APP_CHANNELS.V1_PROGRESS, p),
      });
      // A oferta do onboarding some no "Ir para o app" (o renderer mostra o relatório antes)
      return report;
    } finally {
      this.closeV1Source();
    }
  }

  closeV1Source() {
    this.v1Source?.close();
    this.v1Source = null;
  }

  async createDeviceLink(): Promise<DeviceLinkView> {
    const link = await this.session.createDeviceLink();
    return { ...link, qrDataUrl: await toQr(link.code) };
  }
}
