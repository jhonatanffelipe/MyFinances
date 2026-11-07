/**
 * Conexão BYO contra o Supabase LOCAL (yarn core:test:sync). Requer `yarn db:start`.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { AppError, checkConnection, MemoryKeyValueStore, MIN_SCHEMA_VERSION, type FetchLike } from '../src/index';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const API: string = status.API_URL;
const KEY: string = status.PUBLISHABLE_KEY;
const ANON_JWT: string = status.ANON_KEY;
const fetchFn = fetch as unknown as FetchLike;

describe('conexão com o Supabase local', () => {
  it('projeto preparado passa na verificação (publishable key e anon JWT)', async () => {
    assert.equal((await checkConnection({ url: API, key: KEY }, fetchFn)).schemaVersion, MIN_SCHEMA_VERSION);
    assert.equal((await checkConnection({ url: API, key: ANON_JWT }, fetchFn)).schemaVersion, MIN_SCHEMA_VERSION);
  });

  it('chave com assinatura inválida é recusada pelo projeto', async () => {
    const forged = ANON_JWT.split('.').slice(0, 2).join('.') + '.assinaturaerrada';
    await assert.rejects(checkConnection({ url: API, key: forged }, fetchFn), (e) => AppError.is(e, 'INVALID_CONNECTION') && e.details?.reason === 'key');
  });

  it('porta sem nada escutando: URL errada (com internet) ou offline (sem)', async () => {
    const url = 'http://127.0.0.1:59999';
    await assert.rejects(
      checkConnection({ url, key: KEY }, fetchFn, { internetProbe: async () => true }),
      (e) => AppError.is(e, 'INVALID_CONNECTION') && e.details?.reason === 'unreachable',
    );
    await assert.rejects(checkConnection({ url, key: KEY }, fetchFn, { internetProbe: async () => false }), (e) => AppError.is(e, 'OFFLINE'));
  });

  it('a sessão salva no KeyValueStore sobrevive a "fechar e reabrir" o app', async () => {
    const storage = new MemoryKeyValueStore();
    const first = createClient(API, KEY, { auth: { storage, persistSession: true, autoRefreshToken: false } });
    const email = `reabrir-${randomUUID()}@test.local`;
    const signUp = await first.auth.signUp({ email, password: 'senha1234', options: { data: { name: 'Reabrir' } } });
    assert.ifError(signUp.error);
    assert.ok(storage.keys().some((k) => k.endsWith('-auth-token')), 'sessão gravada no store');

    // "Reabre o app": cliente novo, mesmo store
    const reopened = createClient(API, KEY, { auth: { storage, persistSession: true, autoRefreshToken: false } });
    const { data } = await reopened.auth.getSession();
    assert.equal(data.session?.user.email, email);
    const families = await reopened.from('families').select('id');
    assert.ifError(families.error);
  });
});
