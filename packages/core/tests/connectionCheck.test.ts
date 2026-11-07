import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AppError,
  ChunkedKeyValueStore,
  checkConnection,
  ConnectionRepository,
  localDatabaseName,
  MemoryKeyValueStore,
  MIN_SCHEMA_VERSION,
  type FetchLike,
} from '../src/index';

const conn = { url: 'https://abcd.supabase.co', key: 'sb_publishable_teste' };

function fakeFetch(status: number, body: unknown): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    return { status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  }) as unknown as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

const failingFetch: FetchLike = async () => {
  throw new TypeError('fetch failed');
};

const rejectsWith = (code: string, reason?: string) => (e: unknown) =>
  AppError.is(e) && e.code === code && (reason === undefined || e.details?.reason === reason);

describe('checkConnection', () => {
  it('projeto com schema na versão certa', async () => {
    const fetch = fakeFetch(200, MIN_SCHEMA_VERSION);
    const ok = await checkConnection(conn, fetch);
    assert.equal(ok.schemaVersion, MIN_SCHEMA_VERSION);
    assert.deepEqual(fetch.calls, ['https://abcd.supabase.co/rest/v1/rpc/app_schema_version']);
  });

  it('chave secreta é recusada antes de qualquer acesso à rede', async () => {
    const fetch = fakeFetch(200, 1);
    await assert.rejects(checkConnection({ ...conn, key: 'sb_secret_x' }, fetch), rejectsWith('SECRET_KEY_REJECTED'));
    assert.equal(fetch.calls.length, 0);
  });

  it('sem internet ≠ URL errada', async () => {
    await assert.rejects(checkConnection(conn, failingFetch, { internetProbe: async () => false }), rejectsWith('OFFLINE'));
    await assert.rejects(
      checkConnection(conn, failingFetch, { internetProbe: async () => true }),
      rejectsWith('INVALID_CONNECTION', 'unreachable'),
    );
  });

  it('chave recusada pelo projeto', async () => {
    await assert.rejects(checkConnection(conn, fakeFetch(401, { message: 'Invalid API key' })), rejectsWith('INVALID_CONNECTION', 'key'));
  });

  it('projeto pausado', async () => {
    await assert.rejects(checkConnection(conn, fakeFetch(540, 'Project paused')), rejectsWith('PROJECT_PAUSED'));
    await assert.rejects(
      checkConnection(conn, fakeFetch(503, { message: 'Project is paused, restore it in the dashboard' })),
      rejectsWith('PROJECT_PAUSED'),
    );
  });

  it('projeto vazio (setup.sql não rodado)', async () => {
    const body = { code: 'PGRST202', message: 'Could not find the function public.app_schema_version without parameters' };
    await assert.rejects(checkConnection(conn, fakeFetch(404, body)), rejectsWith('SCHEMA_MISSING'));
  });

  it('schema desatualizado', async () => {
    await assert.rejects(checkConnection(conn, fakeFetch(200, MIN_SCHEMA_VERSION - 1)), rejectsWith('SCHEMA_OUTDATED'));
  });

  it('servidor instável e endereço que não é Supabase', async () => {
    await assert.rejects(checkConnection(conn, fakeFetch(502, 'Bad gateway')), rejectsWith('OFFLINE'));
    await assert.rejects(checkConnection(conn, fakeFetch(200, '<html>oi</html>')), rejectsWith('INVALID_CONNECTION', 'not_supabase'));
  });
});

describe('armazenamento da conexão', () => {
  it('salva, recarrega e esquece', async () => {
    const repo = new ConnectionRepository(new MemoryKeyValueStore());
    assert.equal(await repo.load(), null);
    await repo.save({ url: 'https://AbCd.supabase.co/', key: 'sb_publishable_x' }, '2026-11-07T00:00:00Z');
    const loaded = await repo.load();
    assert.equal(loaded?.url, 'https://abcd.supabase.co');
    assert.equal(loaded?.projectRef, 'abcd');
    await repo.clear();
    assert.equal(await repo.load(), null);
  });

  it('nunca guarda a chave secreta e descarta conteúdo inválido', async () => {
    const store = new MemoryKeyValueStore();
    const repo = new ConnectionRepository(store);
    await assert.rejects(repo.save({ url: 'https://abcd.supabase.co', key: 'sb_secret_x' }, 'agora'), rejectsWith('SECRET_KEY_REJECTED'));
    await store.setItem('myfinances.connection', JSON.stringify({ url: 'https://abcd.supabase.co', key: 'sb_secret_x' }));
    assert.equal(await repo.load(), null);
    assert.equal(await store.getItem('myfinances.connection'), null);
  });

  it('divide valores grandes em pedaços e remonta', async () => {
    const inner = new MemoryKeyValueStore();
    const store = new ChunkedKeyValueStore(inner, 100);
    const session = JSON.stringify({ access_token: 'x'.repeat(950), refresh_token: 'y'.repeat(40) });
    await store.setItem('sb-abcd-auth-token', session);
    assert.equal(await store.getItem('sb-abcd-auth-token'), session);
    assert.ok(inner.keys().every((k) => /^[A-Za-z0-9._-]+$/.test(k)));
    assert.ok(inner.keys().length > 5);
    await store.setItem('sb-abcd-auth-token', 'curto');
    assert.equal(await store.getItem('sb-abcd-auth-token'), 'curto');
    assert.deepEqual(inner.keys(), ['sb-abcd-auth-token']);
    await store.removeItem('sb-abcd-auth-token');
    assert.deepEqual(inner.keys(), []);
  });

  it('um arquivo local por projeto + usuário', () => {
    assert.equal(localDatabaseName('https://abcd.supabase.co', 'a0b1-c2'), 'abcd-a0b1-c2.sqlite');
    assert.notEqual(localDatabaseName('https://abcd.supabase.co', 'u1'), localDatabaseName('https://efgh.supabase.co', 'u1'));
  });
});
