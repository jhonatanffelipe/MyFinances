import { AppState, AppStateStatus } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import { createExpoAdapter } from '../data/expoAdapter';
import { onDataChanged, setDatabase } from '../data/db';
import { createTablesAndRunMigrations } from '../data/schema';
import { seedInitialCategories } from '../data/seed';
import {
  DriveItem, GraphError, OfflineError, downloadItem, getItem, getProfile, putFileInFolder, uploadItem,
} from './graph';
import { NotSignedInError, isSignedIn, signOut as msSignOut } from './msAuth';
import { DevicePresence, refreshPresence, releasePresence } from './presence';
import {
  LOCAL_DB_NAME, LOCK_HEARTBEAT_MS, PUSH_DEBOUNCE_MS, REMOTE_CHECK_INTERVAL_MS,
} from './config';

/**
 * Sincronização do banco com o OneDrive.
 *
 * O app trabalha numa cópia local do arquivo (funciona offline). Cada alteração é
 * enviada inteira para o OneDrive com "If-Match" (eTag): se o arquivo mudou em outro
 * dispositivo desde o último download, o envio é recusado (HTTP 412), a versão deste
 * celular é salva como cópia de conflito na mesma pasta e a versão do OneDrive é baixada.
 * É a mesma regra do desktop, que nunca sobrescreve uma versão que não leu.
 */

export interface RemoteFileRef {
  itemId: string;
  name: string;
  parentId: string;
}

interface PersistedState {
  remote: RemoteFileRef | null;
  eTag: string | null;
  cTag: string | null;
  pendingUpload: boolean;
  lastSyncAt: string | null;
  accountName: string | null;
  /** Já existe cópia local do banco baixada do OneDrive. */
  localCopy: boolean;
}

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncState extends PersistedState {
  signedIn: boolean;
  dbReady: boolean;
  status: SyncStatus;
  error: string | null;
  otherDevice: DevicePresence | null;
}

export type SyncEvent =
  | { type: 'state'; state: SyncState }
  | { type: 'reloaded' }
  | { type: 'conflict'; conflictCopyName: string | null };

const EMPTY: PersistedState = {
  remote: null, eTag: null, cTag: null, pendingUpload: false, lastSyncAt: null, accountName: null, localCopy: false,
};

const stateFile = new File(Paths.document, 'myfinances-sync.json');

let state: SyncState = { ...EMPTY, signedIn: false, dbReady: false, status: 'idle', error: null, otherDevice: null };
let sqlite: SQLite.SQLiteDatabase | null = null;
const listeners = new Set<(e: SyncEvent) => void>();

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let checkTimer: ReturnType<typeof setInterval> | null = null;
let lockTimer: ReturnType<typeof setInterval> | null = null;
let busy: Promise<void> = Promise.resolve();
let started = false;

// ---------------------------------------------------------------- estado/eventos

function emit(e: SyncEvent) {
  for (const l of listeners) {
    try {
      l(e);
    } catch (err) {
      console.error('[Sync] ouvinte falhou', err);
    }
  }
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit({ type: 'state', state });
}

async function persist(patch: Partial<PersistedState>) {
  setState(patch);
  const { remote, eTag, cTag, pendingUpload, lastSyncAt, accountName, localCopy } = state;
  await stateFile.write(JSON.stringify({ remote, eTag, cTag, pendingUpload, lastSyncAt, accountName, localCopy }));
}

async function loadPersisted(): Promise<PersistedState> {
  try {
    if (stateFile.exists) return { ...EMPTY, ...JSON.parse(await stateFile.text()) };
  } catch (err) {
    console.warn('[Sync] estado salvo inválido, ignorando', err);
  }
  return { ...EMPTY };
}

export function getSyncState() {
  return state;
}

export function subscribeSync(listener: (e: SyncEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Executa operações de sincronização uma de cada vez. */
function serial(task: () => Promise<void>): Promise<void> {
  const next = busy.then(task, task);
  busy = next.catch(() => {});
  return next;
}

function describeError(err: unknown) {
  if (err instanceof OfflineError) return 'Sem conexão — as alterações serão enviadas quando a internet voltar.';
  if (err instanceof NotSignedInError) return 'Conecte sua conta Microsoft novamente.';
  return (err as any)?.message || String(err);
}

function handleError(err: unknown) {
  console.warn('[Sync]', err);
  if (err instanceof OfflineError) {
    setState({ status: 'offline', error: describeError(err) });
  } else {
    setState({ status: 'error', error: describeError(err) });
  }
}

// ---------------------------------------------------------------- banco local

async function closeLocal() {
  setDatabase(null);
  if (sqlite) {
    try {
      await sqlite.closeAsync();
    } catch (_) {}
    sqlite = null;
  }
  setState({ dbReady: false });
}

async function sha(bytes: Uint8Array, algorithm = Crypto.CryptoDigestAlgorithm.SHA256) {
  const digest = new Uint8Array(await Crypto.digest(algorithm, bytes as Uint8Array<ArrayBuffer>));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/*
 * A cópia local é manipulada só pelo expo-sqlite (pelo nome, no diretório padrão dele):
 * entra por deserialize + backup e sai por serializeAsync. Antes, o expo-file-system
 * gravava o download num caminho e o SQLite abria outro arquivo no Expo Go.
 */

/** Abre a cópia local, aplica migrações e retorna se o banco foi alterado por elas. */
async function openLocal(): Promise<boolean> {
  await closeLocal();
  sqlite = await SQLite.openDatabaseAsync(LOCAL_DB_NAME);
  // Arquivo único (sem WAL), para poder ser enviado inteiro ao OneDrive
  await sqlite.execAsync('PRAGMA journal_mode = DELETE;');
  const before = await sha(await sqlite.serializeAsync());
  const adapter = createExpoAdapter(sqlite);
  await createTablesAndRunMigrations(adapter);
  await seedInitialCategories(adapter);
  setDatabase(adapter);
  setState({ dbReady: true });
  return before !== (await sha(await sqlite.serializeAsync()));
}

/** Substitui a cópia local pelos bytes baixados do OneDrive. */
async function replaceLocal(bytes: Uint8Array) {
  await closeLocal();
  const downloaded = await SQLite.deserializeDatabaseAsync(bytes);
  const local = await SQLite.openDatabaseAsync(LOCAL_DB_NAME);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: downloaded, destDatabase: local });
  } finally {
    await downloaded.closeAsync().catch(() => {});
    await local.closeAsync().catch(() => {});
  }
}

/** Confere o download com o SHA-1 informado pelo OneDrive (quando disponível). */
async function assertDownloadMatches(meta: DriveItem, bytes: Uint8Array) {
  const expected = meta.file?.hashes?.sha1Hash;
  if (!expected) return;
  if ((await sha(bytes, Crypto.CryptoDigestAlgorithm.SHA1)) !== expected.toLowerCase()) {
    throw new Error('O arquivo baixado não corresponde à versão atual do OneDrive. Tente sincronizar novamente.');
  }
}

async function downloadAndOpen(remote: RemoteFileRef) {
  const meta = await getItem(remote.itemId);
  const bytes = await downloadItem(remote.itemId);
  await assertDownloadMatches(meta, bytes);
  await replaceLocal(bytes);
  const migrated = await openLocal();
  await persist({ eTag: meta.eTag || null, cTag: meta.cTag || null, pendingUpload: migrated, lastSyncAt: new Date().toISOString(), localCopy: true });
  if (migrated) schedulePush();
}

// ---------------------------------------------------------------- envio/recebimento

function timestampForName() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

/** Envia a cópia local; trata conflito se o arquivo mudou no OneDrive. */
async function pushNow() {
  const remote = state.remote;
  if (!remote || !state.pendingUpload || !sqlite) return;
  setState({ status: 'syncing', error: null });

  const bytes = await sqlite.serializeAsync();
  let result = state.eTag ? await uploadItem(remote.itemId, bytes, state.eTag) : null;

  if (!result) {
    const meta = await getItem(remote.itemId);
    if (state.cTag && meta.cTag === state.cTag && meta.eTag) {
      // Só os metadados mudaram (ex.: arquivo renomeado) — conteúdo é o mesmo que temos
      result = await uploadItem(remote.itemId, bytes, meta.eTag);
    }
    if (!result) {
      // Conflito real: guarda a versão deste celular e adota a do OneDrive
      const ext = remote.name.includes('.') ? remote.name.slice(remote.name.lastIndexOf('.')) : '';
      const base = ext ? remote.name.slice(0, -ext.length) : remote.name;
      const copyName = `${base}.conflito-celular-${timestampForName()}${ext}`;
      let savedCopy: string | null = null;
      try {
        await putFileInFolder(remote.parentId, copyName, bytes);
        savedCopy = copyName;
      } catch (err) {
        console.warn('[Sync] não foi possível salvar cópia de conflito', err);
      }
      await persist({ pendingUpload: false });
      await downloadAndOpen(remote);
      setState({ status: 'idle', error: null });
      emit({ type: 'conflict', conflictCopyName: savedCopy });
      return;
    }
  }

  await persist({
    eTag: result.eTag || null,
    cTag: result.cTag || null,
    pendingUpload: false,
    lastSyncAt: new Date().toISOString(),
  });
  setState({ status: 'idle', error: null });
}

/** Baixa a versão do OneDrive se ela mudou (ou envia a local, se houver pendência). */
async function checkRemoteNow() {
  const remote = state.remote;
  if (!remote) return;
  if (state.pendingUpload) {
    await pushNow();
    return;
  }
  setState({ status: 'syncing', error: null });
  const meta: DriveItem = await getItem(remote.itemId);
  if (meta.cTag && meta.cTag !== state.cTag) {
    await downloadAndOpen(remote);
    emit({ type: 'reloaded' });
  } else {
    await persist({ eTag: meta.eTag || state.eTag, lastSyncAt: new Date().toISOString() });
  }
  setState({ status: 'idle', error: null });
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    serial(pushNow).catch(handleError);
  }, PUSH_DEBOUNCE_MS);
}

async function refreshLock() {
  const remote = state.remote;
  if (!remote) return;
  try {
    const other = await refreshPresence(remote.parentId, remote.name);
    setState({ otherDevice: other });
  } catch (err) {
    console.warn('[Sync] presença', err);
  }
}

// ---------------------------------------------------------------- ciclo de vida

function startForegroundTimers() {
  stopForegroundTimers();
  checkTimer = setInterval(() => {
    serial(checkRemoteNow).catch(handleError);
  }, REMOTE_CHECK_INTERVAL_MS);
  lockTimer = setInterval(refreshLock, LOCK_HEARTBEAT_MS);
  refreshLock();
}

function stopForegroundTimers() {
  if (checkTimer) clearInterval(checkTimer);
  if (lockTimer) clearInterval(lockTimer);
  checkTimer = null;
  lockTimer = null;
}

async function onAppStateChange(next: AppStateStatus) {
  if (!state.remote) return;
  if (next === 'active') {
    startForegroundTimers();
    serial(checkRemoteNow).catch(handleError);
  } else if (next === 'background') {
    stopForegroundTimers();
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    serial(pushNow).catch(handleError);
    releasePresence(state.remote.parentId, state.remote.name).catch(() => {});
  }
}

/** Inicializa: carrega o estado salvo e abre a cópia local (o app funciona offline). */
export async function startSync() {
  if (started) return;
  started = true;
  const saved = await loadPersisted();
  setState({ ...saved, signedIn: await isSignedIn() });

  onDataChanged(async () => {
    if (!state.remote) return;
    await persist({ pendingUpload: true });
    setState({ status: 'pending' });
    schedulePush();
  });
  AppState.addEventListener('change', onAppStateChange);

  if (state.remote && state.localCopy) {
    try {
      const migrated = await openLocal();
      if (migrated) await persist({ pendingUpload: true });
    } catch (err) {
      handleError(err);
    }
    if (state.signedIn) {
      startForegroundTimers();
      serial(checkRemoteNow).catch(handleError);
    }
  }
}

/** Chamado após o login Microsoft concluir. */
export async function onSignedIn() {
  setState({ signedIn: true, error: null });
  try {
    const profile = await getProfile();
    await persist({ accountName: profile.displayName || profile.userPrincipalName || profile.mail || null });
  } catch (err) {
    console.warn('[Sync] perfil', err);
  }
}

/** Define o arquivo do OneDrive a usar e baixa a cópia local. */
export function connectRemoteFile(item: DriveItem) {
  return serial(async () => {
    const parentId = item.parentReference?.id;
    if (!parentId) throw new Error('Não foi possível identificar a pasta do arquivo');
    if (state.remote && state.remote.itemId !== item.id) {
      releasePresence(state.remote.parentId, state.remote.name).catch(() => {});
    }
    setState({ status: 'syncing', error: null });
    const remote: RemoteFileRef = { itemId: item.id, name: item.name, parentId };
    await persist({ remote, eTag: null, cTag: null, pendingUpload: false });
    await downloadAndOpen(remote);
    setState({ status: 'idle' });
    startForegroundTimers();
  });
}

/** Sincroniza agora (botão "Sincronizar" / puxar para atualizar). */
export function syncNow() {
  return serial(checkRemoteNow).catch((err) => {
    handleError(err);
    throw err;
  });
}

/** Desconecta a conta e esquece o arquivo (a cópia local é apagada). */
export async function disconnect() {
  await serial(async () => {
    stopForegroundTimers();
    if (state.remote) await releasePresence(state.remote.parentId, state.remote.name).catch(() => {});
    await closeLocal();
    await SQLite.deleteDatabaseAsync(LOCAL_DB_NAME).catch(() => {});
    await msSignOut();
    await persist({ ...EMPTY });
    setState({ signedIn: false, status: 'idle', error: null, otherDevice: null });
  });
}

export function hasLocalDatabase() {
  return state.localCopy;
}

export { GraphError };
