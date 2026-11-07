import { createAccount, type Account } from '../createAccount';
import { createCore, type Core } from '../createCore';
import { checkConnection, type FetchLike } from '../connection/checkConnection';
import { decodeConnectionCode, normalizeProjectUrl, type ConnectionCode, type SupabaseConnection } from '../connection/connection';
import { ConnectionRepository, localDatabaseName, type KeyValueStore, type SavedConnection } from '../connection/storage';
import type { DbAdapter } from '../db/adapter';
import { MemorySessionProvider, type IdGenerator } from '../domain/ports';
import { AppError } from '../errors/AppError';
import type { ConnectedDevice } from '../remote/gateways';
import { SupabaseGateway, SupabasePairingFunction, type SupabaseLike } from '../remote/supabaseGateway';
import { SupabaseRemoteSync } from '../sync/remote';
import { SyncEngine, type NetworkMonitor, type RemoteChangedTable } from '../sync/syncEngine';
import { CompletePairing, ScanDeviceLink, WaitPairingApproval } from '../use-cases/devices';
import { validEmail, validPassword } from '../use-cases/account';
import { INITIAL_APP_STATE, IDLE_SYNC_STATUS, type AppState, type PairingRequestView, type QrPreview, type SyncStatusView } from './types';

/** Timers do ambiente (o core compila sem DOM/Node). */
const timers = globalThis as unknown as {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

/** Janela para juntar vários pulls (ex.: importação em lote de outro membro) numa recarga só. */
const DATA_CHANGED_DEBOUNCE_MS = 500;
/** Tabelas da família que, ao mudar no servidor, acordam o SyncEngine para um pull. */
const REALTIME_TABLES = ['movements', 'categories', 'credit_cards', 'fixed_expenses', 'fixed_expense_payments', 'family_members'];

/** Canal Realtime (estrutural: o core não depende do supabase-js). */
export interface RealtimeChannelLike {
  on(type: 'postgres_changes', filter: Record<string, unknown>, callback: (payload: { new: unknown }) => void): RealtimeChannelLike;
  subscribe(): RealtimeChannelLike;
}

/** O client do supabase-js que o app cria (com storage, storageKey e transporte do Realtime). */
export interface AppSupabaseClient extends SupabaseLike {
  rpc(fn: string, args?: Record<string, unknown>): any;
  channel(name: string): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): Promise<unknown> | unknown;
  removeAllChannels(): Promise<unknown> | unknown;
}

/** SQLite local aberto pelo app (arquivo por projeto + usuário). */
export interface LocalDatabaseHandle {
  adapter: DbAdapter;
  close(): void | Promise<void>;
}

export interface AppSessionDependencies {
  /** Store seguro (conexão, sessão do Auth, família ativa). */
  secure: KeyValueStore;
  network: NetworkMonitor;
  fetch: FetchLike;
  /** Cria o client com `auth.storage = secure` e `auth.storageKey = SUPABASE_AUTH_STORAGE_KEY`. */
  createClient(connection: SavedConnection): AppSupabaseClient;
  /** Abre (ou cria) o SQLite local com esse nome de arquivo. */
  openDatabase(fileName: string): Promise<LocalDatabaseHandle>;
  device: { name(): string; platform: ConnectedDevice['platform'] };
  newId?: IdGenerator;
  /** O computador escuta pedidos de "Conectar celular" para mostrar Permitir/Negar. */
  watchPairingRequests?: boolean;
  log?: (message: string, err?: unknown) => void;
}

/** Dados de um usuário logado: SQLite local dele, core, conta e sincronização. */
interface Workspace {
  db: LocalDatabaseHandle;
  core: Core;
  account: Account;
  engine: SyncEngine;
  session: MemorySessionProvider;
  userId: string;
  engineStarted: boolean;
  familyChannel: RealtimeChannelLike | null;
  pairingChannel: RealtimeChannelLike | null;
  unsubscribers: Array<() => void>;
}

type Listener<T> = (value: T) => void;

/**
 * Orquestra o app (desktop e mobile): conexão com o Supabase do usuário, sessão, banco
 * local por usuário, sincronização, Realtime e o QR do celular. As telas observam o
 * `AppState` e chamam os use cases do `core()` da família ativa.
 *
 * Abertura offline-first: com sessão salva, abre com o banco local na hora e atualiza
 * famílias, perfil e dados em segundo plano.
 */
export class AppSession {
  private readonly connections: ConnectionRepository;
  private connection: SavedConnection | null = null;
  private client: AppSupabaseClient | null = null;
  private gateway: SupabaseGateway | null = null;
  private workspace: Workspace | null = null;
  private profile: { name: string; phone: string | null; avatar_url: string | null } | null = null;
  private pendingInviteCode: string | null = null;
  private pendingInviteInfo: AppState['pendingInvite'] = null;
  private loginHint: AppState['loginHint'] = null;
  private pairingCode: ConnectionCode | null = null;
  private offerV1Import = false;
  private phase: AppState['phase'] = 'loading';
  private paused = false;
  private dataChanged: { timer: unknown; tables: Set<string> } = { timer: null, tables: new Set() };
  private readonly listeners = {
    state: new Set<Listener<AppState>>(),
    sync: new Set<Listener<SyncStatusView>>(),
    data: new Set<Listener<{ tables: string[] }>>(),
    pairing: new Set<Listener<PairingRequestView>>(),
  };
  private readonly unsubscribeNetwork: () => void;

  constructor(private readonly deps: AppSessionDependencies) {
    this.connections = new ConnectionRepository(deps.secure);
    this.unsubscribeNetwork = deps.network.subscribe((online) => {
      if (online && this.workspace) this.refreshFamilies(this.workspace);
      this.publish().catch(() => undefined);
    });
  }

  // ------------------------------------------------------------------ eventos

  onState(l: Listener<AppState>) {
    return this.listen(this.listeners.state, l);
  }
  onSyncStatus(l: Listener<SyncStatusView>) {
    return this.listen(this.listeners.sync, l);
  }
  /** Dados de OUTRO aparelho chegaram (com debounce): a tela atual recarrega. */
  onDataChanged(l: Listener<{ tables: string[] }>) {
    return this.listen(this.listeners.data, l);
  }
  /** Pedido de "Conectar celular" (só com `watchPairingRequests`). */
  onPairingRequest(l: Listener<PairingRequestView>) {
    return this.listen(this.listeners.pairing, l);
  }

  private listen<T>(set: Set<Listener<T>>, l: Listener<T>) {
    set.add(l);
    return () => {
      set.delete(l);
    };
  }

  private emit<T>(set: Set<Listener<T>>, value: T) {
    for (const l of set) {
      try {
        l(value);
      } catch (err) {
        this.deps.log?.('[app] ouvinte falhou', err);
      }
    }
  }

  // ------------------------------------------------------------------ ciclo de vida

  async init(): Promise<AppState> {
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
      this.deps.log?.('[app] falha ao abrir o banco local', err);
      this.phase = 'login';
    }
    return this.publish();
  }

  async dispose() {
    await this.closeWorkspace();
    this.unsubscribeNetwork();
  }

  /** App em segundo plano (mobile): envia o que falta, para a renovação do token e o Realtime. */
  async pause() {
    if (this.paused) return;
    this.paused = true;
    this.client?.auth.stopAutoRefresh?.();
    const ws = this.workspace;
    if (!ws) return;
    await this.unsubscribeRealtime(ws);
    await ws.engine.syncNow().catch(() => undefined);
  }

  /** App de volta ao primeiro plano: renova o token, reassina o Realtime e busca novidades. */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.client?.auth.startAutoRefresh?.();
    const ws = this.workspace;
    if (!ws) return;
    if (this.deps.watchPairingRequests) this.subscribePairings(ws);
    const familyId = this.activeFamilyId(ws);
    if (familyId) this.subscribeFamily(ws, familyId);
    ws.engine.requestSync();
    this.refreshFamilies(ws);
  }

  // ------------------------------------------------------------------ estado

  private activeFamilyId(ws: Workspace | null): string | null {
    try {
      return ws ? ws.session.current().familyId : null;
    } catch {
      return null;
    }
  }

  async getState(): Promise<AppState> {
    const ws = this.workspace;
    const user = this.gateway && ws ? await this.gateway.currentUser() : null;
    const families = ws ? (await ws.core.repos.families.listFamilies()).map((f) => ({ id: f.id, name: f.name })) : [];
    const activeFamilyId = this.activeFamilyId(ws);
    const members = ws && activeFamilyId ? await ws.core.repos.families.listMembers(activeFamilyId) : [];
    const me = members.find((m) => m.user_id === user?.id);
    return {
      ...INITIAL_APP_STATE,
      phase: this.phase,
      connection: this.connection ? { url: this.connection.url, projectRef: this.connection.projectRef } : null,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: this.profile?.name ?? me?.name ?? user.name ?? user.email,
            phone: this.profile?.phone ?? null,
            avatar_url: this.profile?.avatar_url ?? me?.avatar_url ?? null,
          }
        : null,
      families,
      activeFamilyId,
      role: me?.role ?? null,
      members: members.map((m) => ({ user_id: m.user_id, name: m.name, role: m.role, active: m.active, avatar_url: m.avatar_url })),
      pendingInvite: this.pendingInviteInfo,
      loginHint: this.loginHint,
      offerV1Import: this.offerV1Import && !!ws,
      online: this.deps.network.isOnline(),
    };
  }

  /** Recalcula o estado e avisa as telas. */
  async publish(): Promise<AppState> {
    const state = await this.getState();
    this.emit(this.listeners.state, state);
    return state;
  }

  // ------------------------------------------------------------------ acesso para as telas

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

  private familyId(): string {
    return this.ws().session.current().familyId;
  }

  // ------------------------------------------------------------------ conexão

  private setupClient(connection: SavedConnection) {
    this.client = this.deps.createClient(connection);
    this.gateway = new SupabaseGateway(this.client, { storage: this.deps.secure });
  }

  private async connect(connection: SupabaseConnection) {
    const { connection: checked } = await checkConnection(connection, this.deps.fetch);
    this.connection = await this.connections.save(checked, new Date().toISOString());
    this.setupClient(this.connection);
  }

  /** Garante a conexão com o projeto do código (não troca de projeto com alguém conectado). */
  private async connectTo(code: SupabaseConnection) {
    if (this.connection && normalizeProjectUrl(this.connection.url) !== normalizeProjectUrl(code.url)) {
      throw new AppError('INVALID_CONNECTION', 'Você já está conectado a outro banco. Saia e esqueça o banco atual primeiro.');
    }
    if (!this.connection) await this.connect(code);
  }

  checkConnection(url: string, key: string) {
    return checkConnection({ url, key }, this.deps.fetch).then((r) => ({ schemaVersion: r.schemaVersion }));
  }

  /** Testa a conexão salva (a chave não sai daqui). */
  async testConnection(): Promise<{ schemaVersion: number }> {
    if (!this.connection) throw new AppError('INVALID_CONNECTION', 'Configure o banco primeiro');
    return this.checkConnection(this.connection.url, this.connection.key);
  }

  async saveConnection(url: string, key: string): Promise<AppState> {
    await this.connect({ url, key });
    this.phase = 'login';
    return this.publish();
  }

  /** Código de convite colado: conecta ao banco dele e entra na família após o login. */
  async useConnectionCode(text: string): Promise<AppState> {
    const code = decodeConnectionCode(text);
    await this.connectTo(code);
    if (code.invite) {
      this.pendingInviteCode = text.trim();
      this.pendingInviteInfo = { familyName: code.family?.name ?? null, by: code.by?.name ?? null };
    }
    if (this.workspace) await this.applyPendingInvite();
    else this.phase = 'login';
    return this.publish();
  }

  async forgetConnection(): Promise<AppState> {
    if (this.workspace) await this.signOut(true);
    await this.connections.clear();
    await this.client?.removeAllChannels();
    this.connection = null;
    this.client = null;
    this.gateway = null;
    this.pendingInviteCode = null;
    this.pendingInviteInfo = null;
    this.loginHint = null;
    this.pairingCode = null;
    this.phase = 'connect';
    return this.publish();
  }

  // ------------------------------------------------------------------ QR do celular (antes do login)

  private pairingFor = (c: SupabaseConnection) => new SupabasePairingFunction(c, this.deps.fetch);

  /** Celular leu o QR do computador: conecta ao projeto e diz o que dá para fazer. */
  async readConnectionQr(text: string): Promise<QrPreview> {
    const { code, pairingAvailable } = await new ScanDeviceLink(this.pairingFor).decode(text);
    await this.connectTo(code);
    return {
      familyName: code.family?.name ?? null,
      byName: code.by?.name ?? null,
      canPair: pairingAvailable,
      canInvite: !!code.invite,
    };
  }

  /**
   * "Sou eu": reserva o QR e o computador recebe o pedido. Sem a Edge Function, cai no
   * login com o e-mail de quem gerou o QR preenchido.
   */
  async startPairing(text: string): Promise<{ mode: 'pair' | 'password'; userName: string | null }> {
    const scan = await new ScanDeviceLink(this.pairingFor).execute(text, this.deps.device.name());
    await this.connectTo(scan.code);
    if (scan.mode === 'password') {
      this.loginHint = { email: scan.email };
      this.phase = 'login';
      await this.publish();
      return { mode: 'password', userName: null };
    }
    this.pairingCode = scan.code;
    return { mode: 'pair', userName: scan.userName };
  }

  /** Espera o "Permitir" no computador e entra com uma sessão própria deste aparelho. */
  async completePairing(options: { isCancelled?: () => boolean } = {}): Promise<AppState> {
    const code = this.pairingCode;
    if (!code) throw new AppError('PAIRING_EXPIRED', 'Leia o QR do computador de novo');
    const tokenHash = await new WaitPairingApproval(this.pairingFor, (ms) => new Promise<void>((r) => timers.setTimeout(r, ms))).execute(code, options);
    const user = await new CompletePairing(this.gw(), this.gw()).execute(tokenHash, {
      name: this.deps.device.name(),
      platform: this.deps.device.platform,
    });
    this.pairingCode = null;
    await this.openWorkspace(user.id, { preferFamilyId: code.family?.id });
    return this.publish();
  }

  // ------------------------------------------------------------------ conta

  async signIn(email: string, password: string): Promise<AppState> {
    if (!password) throw AppError.validation('Informe a senha', { field: 'password' });
    const user = await this.gw().signIn({ email: validEmail(email), password });
    this.loginHint = null;
    await this.openWorkspace(user.id);
    await this.applyPendingInvite();
    return this.publish();
  }

  async signUp(name: string, email: string, password: string): Promise<AppState> {
    const clean = (name ?? '').trim();
    if (clean.length < 2) throw AppError.validation('Informe seu nome', { field: 'name' });
    const user = await this.gw().signUp({ name: clean, email: validEmail(email), password: validPassword(password) });
    this.loginHint = null;
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
    this.offerV1Import = false;
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
    const state = await this.ws().account.families.create.execute(name);
    await this.activateFamily(state.activeFamilyId!, { initialLoad: true });
    this.offerV1Import = true; // família nova: oferece importar o banco da v1
    return this.publish();
  }

  /** "Começar do zero" ou importação concluída: some a oferta (continua no Perfil). */
  dismissV1Offer(): Promise<AppState> {
    this.offerV1Import = false;
    return this.publish();
  }

  async joinFamily(codeOrToken: string): Promise<AppState> {
    const state = await this.ws().account.families.join.execute(codeOrToken);
    await this.activateFamily(state.activeFamilyId!, { initialLoad: true });
    return this.publish();
  }

  async selectFamily(familyId: string): Promise<AppState> {
    await this.ws().account.session.selectFamily(familyId);
    await this.activateFamily(familyId);
    this.notifyDataChanged();
    return this.publish();
  }

  /** Código de convite (mf1...) da família ativa. */
  async createInvite(): Promise<{ code: string }> {
    const { code } = await this.ws().account.families.createInvite.execute(this.familyId());
    return { code };
  }

  async setMemberActive(userId: string, active: boolean): Promise<AppState> {
    const ws = this.ws();
    await ws.account.families.setMemberActive.execute(this.familyId(), userId, active);
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

  /** QR "Conectar celular" (código; a imagem fica com o app). */
  createDeviceLink() {
    return this.ws().account.devices.createLink.execute(this.familyId());
  }

  pendingPairings() {
    return this.ws().account.devices.listPending.execute();
  }

  resolvePairing(id: string, approve: boolean) {
    return this.ws().account.devices.resolve.execute(id, approve);
  }

  async listDevices() {
    const list = await this.ws().account.devices.list.execute();
    return list.map(({ sessionId: _sessionId, ...d }) => d);
  }

  revokeDevice(id: string) {
    return this.ws().account.devices.revoke.execute(id);
  }

  // ------------------------------------------------------------------ sincronização

  syncStatus(): SyncStatusView {
    return this.workspace?.engine.getStatus() ?? IDLE_SYNC_STATUS;
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

  private async openWorkspace(userId: string, options: { preferFamilyId?: string } = {}) {
    if (this.workspace?.userId === userId) return;
    await this.closeWorkspace();
    const connection = this.connection!;
    const db = await this.deps.openDatabase(localDatabaseName(connection.url, userId));
    const session = new MemorySessionProvider();
    const core = await createCore({ db: db.adapter, session, newId: this.deps.newId });
    const account = createAccount({
      core,
      session,
      gateway: this.gateway!,
      connection,
      keyValue: this.deps.secure,
      pairingFor: this.pairingFor,
    });
    const engine = new SyncEngine(core.store, new SupabaseRemoteSync(this.client!), this.deps.network);
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
      engine.onStatus((s) => this.emit(this.listeners.sync, s)),
      engine.onRemoteChange((tables: RemoteChangedTable[]) => this.notifyDataChanged(tables)),
    );

    // Offline-first: abre com as famílias do banco local, sem esperar o servidor
    const local = await account.session.resume({ online: false });
    if (!local) throw new AppError('NOT_AUTHENTICATED', 'Sessão expirada');
    this.loadProfile(ws);
    if (this.deps.watchPairingRequests) this.subscribePairings(ws);
    // "Aparelhos conectados" (melhor esforço: pode estar offline)
    account.devices.register.execute(this.deps.device.name(), this.deps.device.platform).catch(() => undefined);

    if (local.activeFamilyId) {
      await this.activateFamily(local.activeFamilyId);
      this.refreshFamilies(ws);
      return;
    }
    // Primeiro acesso neste aparelho: a lista de famílias só existe no servidor
    const state = await account.session.resume({ online: this.deps.network.isOnline() });
    let familyId = state?.activeFamilyId ?? null;
    // Pareado pelo QR: abre na família do QR
    if (options.preferFamilyId && state?.families.some((f) => f.id === options.preferFamilyId)) {
      await account.session.selectFamily(options.preferFamilyId);
      familyId = options.preferFamilyId;
    }
    if (familyId) await this.activateFamily(familyId, { initialLoad: true });
    else this.phase = 'family';
  }

  /** Atualiza a lista de famílias com o servidor (segundo plano; troca a ativa se ela sumiu). */
  private refreshFamilies(ws: Workspace) {
    const before = this.activeFamilyId(ws);
    ws.account.session
      .refreshFamilies()
      .then(async (state) => {
        if (!state || this.workspace !== ws) return;
        if (state.activeFamilyId !== before) {
          if (state.activeFamilyId) {
            await this.activateFamily(state.activeFamilyId);
            this.notifyDataChanged();
          } else {
            this.phase = 'family';
          }
        }
        await this.publish();
      })
      .catch(() => undefined); // offline: segue com o cache local
  }

  /** Dados de OUTRO aparelho chegaram no SQLite local: avisa as telas com debounce. */
  private notifyDataChanged(tables: string[] = []) {
    tables.forEach((t) => this.dataChanged.tables.add(t));
    if (this.dataChanged.timer) timers.clearTimeout(this.dataChanged.timer);
    this.dataChanged.timer = timers.setTimeout(() => {
      const changed = [...this.dataChanged.tables];
      this.dataChanged = { timer: null, tables: new Set() };
      this.emit(this.listeners.data, { tables: changed });
      // Membros/nome da família vivem no AppState (seletores, "De quem"): republica
      if (changed.length === 0 || changed.includes('members') || changed.includes('families')) this.publish().catch(() => undefined);
    }, DATA_CHANGED_DEBOUNCE_MS);
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
   * neste aparelho: já há rede e a tela não deve abrir vazia).
   */
  private async activateFamily(familyId: string, options: { initialLoad?: boolean } = {}) {
    const ws = this.ws();
    this.phase = 'ready';
    if (!ws.engineStarted) {
      ws.engine.start();
      ws.engineStarted = true;
    }
    if (!this.paused) this.subscribeFamily(ws, familyId);
    // Fora do initialLoad, a carga vai em segundo plano: a tela abre com o banco local e
    // recarrega quando o pull trouxer dados (onRemoteChange → onDataChanged).
    const load = ws.engine.syncNow().catch(() => undefined);
    if (options.initialLoad) await load;
  }

  /** Realtime só ACORDA o SyncEngine; os dados chegam pelo pull (respeita o RLS e o cursor). */
  private subscribeFamily(ws: Workspace, familyId: string) {
    if (ws.familyChannel) this.client!.removeChannel(ws.familyChannel);
    let channel = this.client!.channel(`family-${familyId}`);
    for (const table of REALTIME_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, () =>
        ws.engine.requestSync(),
      );
    }
    ws.familyChannel = channel.subscribe();
  }

  /** Pedidos de "Conectar celular" deste usuário (o computador mostra Permitir/Negar). */
  private subscribePairings(ws: Workspace) {
    if (ws.pairingChannel) this.client!.removeChannel(ws.pairingChannel);
    ws.pairingChannel = this.client!
      .channel(`pairings-${ws.userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'device_pairings' }, (payload) => {
        const row = payload.new as { id: string; status: string; device_name: string; family_id: string; expires_at: string };
        if (row.status === 'WAITING_APPROVAL') {
          this.emit(this.listeners.pairing, { id: row.id, deviceName: row.device_name, familyId: row.family_id, expiresAt: row.expires_at });
        }
      })
      .subscribe();
  }

  private async unsubscribeRealtime(ws: Workspace) {
    if (ws.familyChannel) await this.client?.removeChannel(ws.familyChannel);
    if (ws.pairingChannel) await this.client?.removeChannel(ws.pairingChannel);
    ws.familyChannel = null;
    ws.pairingChannel = null;
  }

  private async closeWorkspace() {
    const ws = this.workspace;
    if (!ws) return;
    this.workspace = null;
    ws.engine.stop();
    ws.unsubscribers.forEach((u) => u());
    await this.unsubscribeRealtime(ws);
    await ws.db.close();
  }
}
