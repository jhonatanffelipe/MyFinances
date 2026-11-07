/**
 * AppSession (orquestração usada pelo desktop e pelo celular) contra o Supabase LOCAL.
 * Requer `yarn db:start` e `yarn functions:serve` (Edge Function pair-device).
 * Cada "aparelho" é um AppSession com storage seguro, client, SQLite e rede próprios.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import initSqlJs, { type Database } from 'sql.js';
import {
  AppSession,
  createSqlJsAdapter,
  MemoryKeyValueStore,
  SUPABASE_AUTH_STORAGE_KEY,
  type AppSupabaseClient,
  type ConnectedDevice,
  type FetchLike,
  type NetworkMonitor,
} from '../src/index';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const connection = { url: status.API_URL as string, key: status.PUBLISHABLE_KEY as string };
const email = (name: string) => `${name.toLowerCase()}-${randomUUID()}@test.local`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rede controlada pelo teste (modo avião). */
class FakeNetwork implements NetworkMonitor {
  private listeners = new Set<(online: boolean) => void>();
  constructor(private online = true) {}
  isOnline() {
    return this.online;
  }
  subscribe(l: (online: boolean) => void) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
  set(online: boolean) {
    this.online = online;
    this.listeners.forEach((l) => l(online));
  }
}

const SQL = await initSqlJs();
const sessions: AppSession[] = [];

/** Um aparelho. `files` simula o disco (reabrir o app reaproveita o banco local). */
function device(name: string, platform: ConnectedDevice['platform'], options: { secure?: MemoryKeyValueStore; files?: Map<string, Database>; network?: FakeNetwork } = {}) {
  const secure = options.secure ?? new MemoryKeyValueStore();
  const files = options.files ?? new Map<string, Database>();
  const network = options.network ?? new FakeNetwork();
  // Rede "desligada" de verdade para o client: o fetch falha como no modo avião
  const fetchFn = ((input: any, init?: any) => (network.isOnline() ? fetch(input, init) : Promise.reject(new TypeError('fetch failed')))) as typeof fetch;
  const session = new AppSession({
    secure,
    network,
    fetch: fetchFn as unknown as FetchLike,
    createClient: (c) =>
      createClient(c.url, c.key, {
        auth: { storage: secure, storageKey: SUPABASE_AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: fetchFn },
      }) as unknown as AppSupabaseClient,
    openDatabase: async (file) => {
      if (!files.has(file)) files.set(file, new SQL.Database());
      return { adapter: createSqlJsAdapter(files.get(file)!), close: () => undefined };
    },
    device: { name: () => name, platform },
    newId: randomUUID,
    watchPairingRequests: platform === 'desktop',
  });
  sessions.push(session);
  return { session, secure, files, network };
}

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, what: string, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v as T;
    if (Date.now() > deadline) throw new Error(`tempo esgotado esperando: ${what}`);
    await sleep(200);
  }
}

after(async () => {
  await Promise.all(sessions.map((s) => s.dispose().catch(() => undefined)));
});

describe('AppSession: computador + celular', () => {
  // Estado compartilhado entre os passos (um cenário só, em ordem)
  const pc = device('MacBook', 'desktop');
  const anaPhone = device('Moto G (Android)', 'android');
  const betoPhone = device('Galaxy (Android)', 'android');
  let familyId = '';

  it('computador: conectar → cadastro → criar família', async () => {
    assert.equal((await pc.session.init()).phase, 'connect');
    assert.equal((await pc.session.saveConnection(connection.url, connection.key)).phase, 'login');
    assert.equal((await pc.session.signUp('Ana', email('ana'), 'segredo123')).phase, 'family');
    const state = await pc.session.createFamily('Casa da Ana');
    assert.equal(state.phase, 'ready');
    familyId = state.activeFamilyId!;
    await pc.session.core().movements.create.execute({ description: 'Do computador', amount: 10, date: '2026-10-05', type: 'EXPENSE' });
    await pc.session.syncNow();
  });

  it('"Sou eu": celular lê o QR, o computador permite e ele entra sem senha na família do QR', async () => {
    const requests: string[] = [];
    pc.session.onPairingRequest((r) => requests.push(r.deviceName));
    const link = await pc.session.createDeviceLink();

    assert.equal((await anaPhone.session.init()).phase, 'connect');
    const preview = await anaPhone.session.readConnectionQr(link.code);
    assert.deepEqual(preview, { familyName: 'Casa da Ana', byName: 'Ana', canPair: true, canInvite: true });
    assert.equal((await anaPhone.session.startPairing(link.code)).mode, 'pair');

    const completing = anaPhone.session.completePairing();
    const pending = await waitFor(async () => (await pc.session.pendingPairings())[0], 'pedido no computador');
    assert.equal(pending.deviceName, 'Moto G (Android)');
    await pc.session.resolvePairing(pending.id, true);
    const state = await completing;

    assert.equal(state.phase, 'ready');
    assert.equal(state.activeFamilyId, familyId);
    assert.equal(state.user?.name, 'Ana');
    const list = await anaPhone.session.core().movements.list.execute({ creditCardId: 'all_ungrouped' });
    assert.deepEqual(list.data.map((m) => m.description), ['Do computador']);
    const devices = await pc.session.listDevices();
    assert.ok(devices.some((d) => d.deviceName === 'Moto G (Android)' && d.platform === 'android'));
    // O Realtime em device_pairings avisou o computador (diálogo Permitir/Negar)
    assert.ok(requests.includes('Moto G (Android)'), 'Realtime do pareamento chegou ao computador');
  });

  it('"Sou outra pessoa": o QR vira convite; cadastro já entra na família', async () => {
    const link = await pc.session.createDeviceLink();
    await betoPhone.session.init();
    const preview = await betoPhone.session.readConnectionQr(link.code);
    assert.equal(preview.canInvite, true);
    const login = await betoPhone.session.useConnectionCode(link.code);
    assert.equal(login.phase, 'login');
    assert.deepEqual(login.pendingInvite, { familyName: 'Casa da Ana', by: 'Ana' });
    const state = await betoPhone.session.signUp('Beto', email('beto'), 'segredo123');
    assert.equal(state.phase, 'ready');
    assert.equal(state.activeFamilyId, familyId);
    assert.deepEqual(state.members.map((m) => m.name).sort(), ['Ana', 'Beto']);
  });

  it('celular em modo avião lança; ao voltar a internet, o computador da Ana recebe sozinho (Realtime)', async () => {
    const dataChanged: string[][] = [];
    pc.session.onDataChanged((c) => dataChanged.push(c.tables));
    betoPhone.network.set(false);
    await betoPhone.session.core().movements.create.execute({ description: 'Padaria no modo avião', amount: 9.9, date: '2026-10-06', type: 'EXPENSE' });
    await betoPhone.session.syncNow().catch(() => undefined);
    assert.equal(betoPhone.session.syncStatus().pending, 1);
    assert.equal(betoPhone.session.syncStatus().phase, 'offline');

    betoPhone.network.set(true); // o SyncEngine envia sozinho ao voltar a rede
    const seen = await waitFor(async () => {
      const r = await pc.session.core().movements.list.execute({ creditCardId: 'all_ungrouped', search: 'modo avião' });
      return r.data[0];
    }, 'lançamento do Beto no computador');
    assert.equal(seen.member_name, 'Beto');
    assert.equal(betoPhone.session.syncStatus().pending, 0);
    // O aviso para a tela recarregar vem com debounce (junta vários pulls)
    await waitFor(async () => dataChanged.some((t) => t.includes('movements')), 'aviso de recarga no computador');
  });

  it('segundo plano envia o que falta; primeiro plano busca novidades', async () => {
    await anaPhone.session.core().movements.create.execute({ description: 'Antes de minimizar', amount: 5, date: '2026-10-07', type: 'EXPENSE' });
    await anaPhone.session.pause();
    assert.equal(anaPhone.session.syncStatus().pending, 0, 'pause() envia a fila');
    await pc.session.core().movements.create.execute({ description: 'Enquanto o celular dormia', amount: 7, date: '2026-10-07', type: 'EXPENSE' });
    await pc.session.syncNow();
    anaPhone.session.resume();
    await waitFor(async () => {
      const r = await anaPhone.session.core().movements.list.execute({ creditCardId: 'all_ungrouped', search: 'dormia' });
      return r.total === 1;
    }, 'novidade no celular ao voltar');
  });

  it('reabrir o app sem internet abre na hora com o banco local', async () => {
    const network = new FakeNetwork(false);
    const reopened = device('Galaxy (Android)', 'android', { secure: betoPhone.secure, files: betoPhone.files, network });
    const started = Date.now();
    const state = await reopened.session.init();
    assert.ok(Date.now() - started < 1500, `abriu em ${Date.now() - started} ms`);
    assert.equal(state.phase, 'ready');
    assert.equal(state.activeFamilyId, familyId);
    const r = await reopened.session.core().movements.list.execute({ creditCardId: 'all_ungrouped' });
    assert.ok(r.total >= 2);
  });
});
