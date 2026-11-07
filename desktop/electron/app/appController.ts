import { app } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import WebSocket from 'ws';
import {
  AppError,
  checkConnection,
  ConnectionRepository,
  createAccount,
  createCore,
  decodeConnectionCode,
  localDatabaseName,
  MemorySessionProvider,
  normalizeProjectUrl,
  SUPABASE_AUTH_STORAGE_KEY,
  SupabaseGateway,
  SupabasePairingFunction,
  SupabaseRemoteSync,
  SyncEngine,
  validEmail,
  validPassword,
  type Account,
  type Core,
  type FetchLike,
  type SavedConnection,
} from '@myfinances/core';
import setupSql from '../../../supabase/setup.sql?raw';
import type { AppState, AppUserView, DeviceLinkView, InviteView, SyncStatusView } from '../../src/interfaces/AppBridge';
import { APP_CHANNELS } from '../../src/interfaces/AppBridge';
import { SafeStorageKeyValueStore } from '../connection/secureStore';
import { broadcast } from './ipcHelpers';
import { LocalDatabaseFile } from './localDatabase';
import { ElectronNetworkMonitor } from './networkMonitor';

const fetchFn = fetch as unknown as FetchLike;
const FAMILY_TABLES = ['movements', 'categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments', 'family_members'];

/** Dados de um usuário logado: SQLite local dele, core, conta e sincronização. */
interface Workspace {
  db: LocalDatabaseFile;
  core: Core;
  account: Account;
  engine: SyncEngine;
  session: MemorySessionProvider;
  userId: string;
  engineStarted: boolean;
  familyChannel: RealtimeChannel | null;
  pairingChannel: RealtimeChannel | null;
  unsubscribers: Array<() => void>;
}

function deviceName() {
  return os.hostname().replace(/\.local$/i, '').slice(0, 60) || 'Computador';
}

/**
 * Orquestra o app no processo main: conexão com o Supabase do usuário, sessão,
 * banco local por usuário, sincronização e Realtime. É a única ponte entre o
 * renderer (via IPC) e o core.
 *
 * Fases: connect (sem banco configurado) → login → family (sem família) → ready.
 */
export class AppController {
  private readonly secure = new SafeStorageKeyValueStore();
  private readonly connections = new ConnectionRepository(this.secure);
  private readonly network = new ElectronNetworkMonitor();
  private connection: SavedConnection | null = null;
  private client: SupabaseClient | null = null;
  private gateway: SupabaseGateway | null = null;
  private workspace: Workspace | null = null;
  private profile: { name: string; phone: string | null; avatar_url: string | null } | null = null;
  private pendingInviteCode: string | null = null;
  private pendingInviteInfo: AppState['pendingInvite'] = null;
  private phase: AppState['phase'] = 'loading';

  // ------------------------------------------------------------------ ciclo de vida

  async init(): Promise<AppState> {
    this.network.subscribe((online) => {
      if (online && this.workspace) this.refreshFamilies(this.workspace);
      this.publish().catch(() => undefined);
    });
    this.connection = await this.connections.load();
    if (!this.connection) {
      this.phase = 'connect';
      return this.publish();
    }
    this.setupClient(this.connection);
    const user = await this.gateway!.currentUser();
    if (!user) {
      this.phase = 'login';
      return this.publish();
    }
    try {
      await this.openWorkspace(user.id);
    } catch (err) {
      console.error('[app] falha ao abrir o banco local:', err);
      this.phase = 'login';
    }
    return this.publish();
  }

  async dispose() {
    await this.closeWorkspace();
    this.network.dispose();
  }

  // ------------------------------------------------------------------ estado

  private async buildState(): Promise<AppState> {
    const ws = this.workspace;
    const user = this.gateway && ws ? await this.gateway.currentUser() : null;
    const families = ws ? (await ws.core.repos.families.listFamilies()).map((f) => ({ id: f.id, name: f.name })) : [];
    let activeFamilyId: string | null = null;
    try {
      activeFamilyId = ws ? ws.session.current().familyId : null;
    } catch {
      activeFamilyId = null;
    }
    const members = ws && activeFamilyId ? await ws.core.repos.families.listMembers(activeFamilyId) : [];
    const me = members.find((m) => m.user_id === user?.id);
    const userView: AppUserView | null = user
      ? {
          id: user.id,
          email: user.email,
          name: this.profile?.name ?? me?.name ?? user.name ?? user.email,
          phone: this.profile?.phone ?? null,
          avatar_url: this.profile?.avatar_url ?? me?.avatar_url ?? null,
        }
      : null;
    return {
      phase: this.phase,
      connection: this.connection ? { url: this.connection.url, projectRef: this.connection.projectRef } : null,
      user: userView,
      families,
      activeFamilyId,
      role: me?.role ?? null,
      members: members.map((m) => ({ user_id: m.user_id, name: m.name, role: m.role, active: m.active, avatar_url: m.avatar_url })),
      pendingInvite: this.pendingInviteInfo,
      online: this.network.isOnline(),
    };
  }

  async getState() {
    return this.buildState();
  }

  /** Recalcula o estado e avisa o renderer. */
  async publish(): Promise<AppState> {
    const state = await this.buildState();
    broadcast(APP_CHANNELS.STATE_CHANGED, state);
    return state;
  }

  // ------------------------------------------------------------------ acesso para os handlers de dados

  /** Core da família ativa (lança se não houver sessão pronta). */
  core(): Core {
    if (!this.workspace || this.phase !== 'ready') throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    return this.workspace.core;
  }

  private ws(): Workspace {
    if (!this.workspace) throw new AppError('NOT_AUTHENTICATED', 'Faça login para continuar');
    return this.workspace;
  }

  private gw(): SupabaseGateway {
    if (!this.gateway) throw new AppError('INVALID_CONNECTION', 'Configure o banco primeiro');
    return this.gateway;
  }

  // ------------------------------------------------------------------ conexão

  private setupClient(connection: SavedConnection) {
    this.client = createClient(connection.url, connection.key, {
      auth: {
        storage: this.secure,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      // Node 20 (Electron 33) não tem WebSocket global
      realtime: { transport: WebSocket as unknown as never },
    });
    this.gateway = new SupabaseGateway(this.client, { storage: this.secure });
  }

  checkConnection(url: string, key: string) {
    return checkConnection({ url, key }, fetchFn).then((r) => ({ schemaVersion: r.schemaVersion }));
  }

  /** Testa a conexão salva (a chave nunca vai para o renderer). */
  async testConnection(): Promise<{ schemaVersion: number }> {
    if (!this.connection) throw new AppError('INVALID_CONNECTION', 'Configure o banco primeiro');
    return this.checkConnection(this.connection.url, this.connection.key);
  }

  async saveConnection(url: string, key: string): Promise<AppState> {
    const { connection } = await checkConnection({ url, key }, fetchFn);
    this.connection = await this.connections.save(connection, new Date().toISOString());
    this.setupClient(this.connection);
    this.phase = 'login';
    return this.publish();
  }

  /** Código de convite colado na tela Conectar: conecta ao banco dele e entra na família após o login. */
  async useConnectionCode(text: string): Promise<AppState> {
    const code = decodeConnectionCode(text);
    if (this.connection && normalizeProjectUrl(this.connection.url) !== normalizeProjectUrl(code.url)) {
      throw new AppError('INVALID_CONNECTION', 'Você já está conectado a outro banco. Saia e esqueça o banco atual primeiro.');
    }
    if (!this.connection) {
      const { connection } = await checkConnection(code, fetchFn);
      this.connection = await this.connections.save(connection, new Date().toISOString());
      this.setupClient(this.connection);
    }
    if (code.invite) {
      this.pendingInviteCode = text.trim();
      this.pendingInviteInfo = { familyName: code.family?.name ?? null, by: code.by?.name ?? null };
    }
    if (this.workspace) {
      await this.applyPendingInvite();
    } else {
      this.phase = 'login';
    }
    return this.publish();
  }

  async forgetConnection(): Promise<AppState> {
    if (this.workspace) await this.signOut(true);
    await this.connections.clear();
    this.client?.removeAllChannels();
    this.connection = null;
    this.client = null;
    this.gateway = null;
    this.pendingInviteCode = null;
    this.pendingInviteInfo = null;
    this.phase = 'connect';
    return this.publish();
  }

  getSetupSql(): string {
    return setupSql;
  }

  // ------------------------------------------------------------------ conta

  async signIn(email: string, password: string): Promise<AppState> {
    if (!password) throw AppError.validation('Informe a senha', { field: 'password' });
    const user = await this.gw().signIn({ email: validEmail(email), password });
    await this.openWorkspace(user.id);
    await this.applyPendingInvite();
    return this.publish();
  }

  async signUp(name: string, email: string, password: string): Promise<AppState> {
    const clean = (name ?? '').trim();
    if (clean.length < 2) throw AppError.validation('Informe seu nome', { field: 'name' });
    const user = await this.gw().signUp({ name: clean, email: validEmail(email), password: validPassword(password) });
    await this.openWorkspace(user.id);
    await this.applyPendingInvite();
    return this.publish();
  }

  requestPasswordReset(email: string) {
    return this.gw().requestPasswordReset(validEmail(email));
  }

  pendingChanges() {
    return this.ws().account.signOut.pendingChanges();
  }

  async signOut(force = false): Promise<AppState> {
    await this.ws().account.signOut.execute({ force });
    await this.closeWorkspace();
    this.profile = null;
    this.phase = 'login';
    return this.publish();
  }

  changePassword(password: string) {
    return this.ws().account.changePassword.execute(password);
  }

  async updateProfile(data: { name: string; phone?: string | null; avatar_url?: string | null }): Promise<AppState> {
    const ws = this.ws();
    await ws.account.updateProfile.execute(data);
    this.profile = await ws.account.getProfile.execute();
    ws.engine.requestSync(); // nome novo aparece na lista de membros
    return this.publish();
  }

  // ------------------------------------------------------------------ família

  async createFamily(name: string): Promise<AppState> {
    const ws = this.ws();
    const state = await ws.account.families.create.execute(name);
    await this.activateFamily(state.activeFamilyId!, { initialLoad: true });
    return this.publish();
  }

  async joinFamily(codeOrToken: string): Promise<AppState> {
    const ws = this.ws();
    const state = await ws.account.families.join.execute(codeOrToken);
    await this.activateFamily(state.activeFamilyId!, { initialLoad: true });
    return this.publish();
  }

  async selectFamily(familyId: string): Promise<AppState> {
    await this.ws().account.session.selectFamily(familyId);
    await this.activateFamily(familyId);
    broadcast(APP_CHANNELS.DATA_CHANGED);
    return this.publish();
  }

  async createInvite(): Promise<InviteView> {
    const ws = this.ws();
    const { code } = await ws.account.families.createInvite.execute(ws.session.current().familyId);
    return { code, qrDataUrl: await QRCode.toDataURL(code, { margin: 1, width: 320, errorCorrectionLevel: 'M' }) };
  }

  async setMemberActive(userId: string, active: boolean): Promise<AppState> {
    const ws = this.ws();
    await ws.account.families.setMemberActive.execute(ws.session.current().familyId, userId, active);
    await ws.engine.syncNow().catch(() => undefined);
    return this.publish();
  }

  private async applyPendingInvite() {
    if (!this.pendingInviteCode || !this.workspace) return;
    const code = this.pendingInviteCode;
    this.pendingInviteCode = null;
    this.pendingInviteInfo = null;
    const state = await this.workspace.account.families.join.execute(code);
    await this.activateFamily(state.activeFamilyId!, { initialLoad: true });
  }

  // ------------------------------------------------------------------ aparelhos

  async createDeviceLink(): Promise<DeviceLinkView> {
    const ws = this.ws();
    const link = await ws.account.devices.createLink.execute(ws.session.current().familyId);
    return { ...link, qrDataUrl: await QRCode.toDataURL(link.code, { margin: 1, width: 320, errorCorrectionLevel: 'M' }) };
  }

  pendingPairings() {
    return this.ws().account.devices.listPending.execute();
  }

  resolvePairing(id: string, approve: boolean) {
    return this.ws().account.devices.resolve.execute(id, approve);
  }

  listDevices() {
    return this.ws().account.devices.list.execute();
  }

  revokeDevice(id: string) {
    return this.ws().account.devices.revoke.execute(id);
  }

  // ------------------------------------------------------------------ sincronização

  syncStatus(): SyncStatusView {
    return this.workspace?.engine.getStatus() ?? {
      phase: 'idle',
      pending: 0,
      failed: 0,
      lastSyncAt: null,
      lastError: null,
      lastConflicts: 0,
      pulledRows: 0,
    };
  }

  async syncNow() {
    await this.ws().engine.syncNow();
  }

  listSyncFailed() {
    return this.ws().engine.listFailed();
  }

  retrySyncFailed() {
    return this.ws().engine.retryFailed();
  }

  discardSyncFailed(id: number) {
    return this.ws().engine.discardFailed(id);
  }

  // ------------------------------------------------------------------ workspace

  private async openWorkspace(userId: string) {
    if (this.workspace?.userId === userId) return;
    await this.closeWorkspace();
    const connection = this.connection!;
    const file = path.join(app.getPath('userData'), 'data', localDatabaseName(connection.url, userId));
    const db = await LocalDatabaseFile.open(file);
    const session = new MemorySessionProvider();
    const core = await createCore({ db: db.adapter, session });
    const account = createAccount({
      core,
      session,
      gateway: this.gateway!,
      connection,
      keyValue: this.secure,
      pairingFor: (c) => new SupabasePairingFunction(c, fetchFn),
    });
    const engine = new SyncEngine(core.store, new SupabaseRemoteSync(this.client!), this.network);
    const ws: Workspace = {
      db,
      core,
      account,
      engine,
      session,
      userId,
      engineStarted: false,
      familyChannel: null,
      pairingChannel: null,
      unsubscribers: [],
    };
    this.workspace = ws;
    ws.unsubscribers.push(
      engine.onStatus((s) => broadcast(APP_CHANNELS.SYNC_STATUS_CHANGED, s)),
      engine.onRemoteChange(() => {
        broadcast(APP_CHANNELS.DATA_CHANGED);
        this.publish().catch(() => undefined); // membros podem ter mudado
      }),
    );

    // Offline-first: abre com as famílias do banco local, sem esperar o servidor
    const local = await account.session.resume({ online: false });
    if (!local) throw new AppError('NOT_AUTHENTICATED', 'Sessão expirada');
    this.loadProfile(ws);
    this.subscribePairings();
    // Registro do aparelho em "Aparelhos conectados" (melhor esforço: pode estar offline)
    account.devices.register.execute(deviceName(), 'desktop').catch(() => undefined);

    if (local.activeFamilyId) {
      await this.activateFamily(local.activeFamilyId);
      this.refreshFamilies(ws);
      return;
    }
    // Primeiro acesso neste computador: a lista de famílias só existe no servidor
    const state = await account.session.resume({ online: this.network.isOnline() });
    if (state?.activeFamilyId) await this.activateFamily(state.activeFamilyId, { initialLoad: true });
    else this.phase = 'family';
  }

  /** Atualiza a lista de famílias com o servidor (segundo plano; troca a ativa se ela sumiu). */
  private refreshFamilies(ws: Workspace) {
    let before: string | null = null;
    try {
      before = ws.session.current().familyId;
    } catch {
      before = null;
    }
    ws.account.session
      .refreshFamilies()
      .then(async (state) => {
        if (!state || this.workspace !== ws) return;
        if (state.activeFamilyId !== before) {
          if (state.activeFamilyId) {
            await this.activateFamily(state.activeFamilyId);
            broadcast(APP_CHANNELS.DATA_CHANGED);
          } else {
            this.phase = 'family';
          }
        }
        await this.publish();
      })
      .catch(() => undefined); // offline: segue com o cache local
  }

  /** Perfil (nome, foto) do servidor; sem rede, fica o que veio da lista de membros. */
  private loadProfile(ws: Workspace) {
    ws.account.getProfile
      .execute()
      .then((profile) => {
        if (this.workspace !== ws) return;
        this.profile = profile;
        return this.publish();
      })
      .catch(() => undefined);
  }

  /**
   * @param initialLoad aguarda o primeiro pull (criar/entrar na família, primeiro acesso
   * neste computador: já há rede e a tela não deve abrir vazia).
   */
  private async activateFamily(familyId: string, options: { initialLoad?: boolean } = {}) {
    const ws = this.ws();
    this.phase = 'ready';
    if (!ws.engineStarted) {
      ws.engine.start();
      ws.engineStarted = true;
    }
    this.subscribeFamily(familyId);
    // Fora do initialLoad, a carga vai em segundo plano: a tela abre com o banco local e
    // recarrega quando o pull trouxer dados (onRemoteChange → DATA_CHANGED). Sem rede,
    // o SyncEngine tenta de novo sozinho.
    const load = ws.engine.syncNow().catch(() => undefined);
    if (options.initialLoad) await load;
  }

  private subscribeFamily(familyId: string) {
    const ws = this.ws();
    if (ws.familyChannel) this.client!.removeChannel(ws.familyChannel);
    let channel = this.client!.channel(`family-${familyId}`);
    for (const table of FAMILY_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, () =>
        ws.engine.requestSync(),
      );
    }
    ws.familyChannel = channel.subscribe();
  }

  /** Pedidos de "Conectar celular" deste usuário: abre o diálogo Permitir/Negar. */
  private subscribePairings() {
    const ws = this.ws();
    ws.pairingChannel = this.client!
      .channel(`pairings-${ws.userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'device_pairings' }, (payload) => {
        const row = payload.new as { id: string; status: string; device_name: string; family_id: string; expires_at: string };
        if (row.status === 'WAITING_APPROVAL') {
          broadcast(APP_CHANNELS.DEVICES_PAIRING_REQUEST, {
            id: row.id,
            deviceName: row.device_name,
            familyId: row.family_id,
            expiresAt: row.expires_at,
          });
        }
      })
      .subscribe();
  }

  private async closeWorkspace() {
    const ws = this.workspace;
    if (!ws) return;
    this.workspace = null;
    ws.engine.stop();
    ws.unsubscribers.forEach((u) => u());
    if (ws.familyChannel) await this.client?.removeChannel(ws.familyChannel);
    if (ws.pairingChannel) await this.client?.removeChannel(ws.pairingChannel);
    ws.db.close();
  }
}
