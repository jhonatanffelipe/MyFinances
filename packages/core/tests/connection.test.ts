import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AppError,
  assertPublishableKey,
  assertSchemaVersion,
  base64UrlDecode,
  base64UrlEncode,
  decodeConnectionCode,
  encodeConnectionCode,
  MIN_SCHEMA_VERSION,
  normalizeProjectUrl,
  projectRef,
} from '../src/index';

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${base64UrlEncode(JSON.stringify(payload))}.assinatura`;

describe('base64url', () => {
  it('ida e volta com acentos e emoji, igual ao Buffer do Node', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'Família Nascimento', 'São Paulo · 💸', '{"x":"ção"}']) {
      const encoded = base64UrlEncode(text);
      assert.equal(encoded, Buffer.from(text, 'utf8').toString('base64url'));
      assert.equal(base64UrlDecode(encoded), text);
    }
  });
});

describe('conexão com o Supabase', () => {
  it('normaliza a URL e extrai o ref do projeto', () => {
    assert.equal(normalizeProjectUrl(' https://AbCd123.supabase.co/ '), 'https://abcd123.supabase.co');
    assert.equal(projectRef('https://abcd123.supabase.co'), 'abcd123');
    assert.equal(normalizeProjectUrl('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
    assert.equal(projectRef('http://127.0.0.1:54321'), '127-0-0-1-54321');
  });

  it('recusa URL sem https (fora do ambiente local) ou com caminho', () => {
    assert.throws(() => normalizeProjectUrl('http://abcd.supabase.co'), (e) => AppError.is(e, 'INVALID_CONNECTION'));
    assert.throws(() => normalizeProjectUrl('https://abcd.supabase.co/rest/v1'), (e) => AppError.is(e, 'INVALID_CONNECTION'));
    assert.throws(() => normalizeProjectUrl('abcd'), (e) => AppError.is(e, 'INVALID_CONNECTION'));
  });

  it('aceita só chaves públicas e recusa a secreta com mensagem clara', () => {
    assert.equal(assertPublishableKey(' sb_publishable_abc '), 'sb_publishable_abc');
    assert.ok(assertPublishableKey(jwt({ role: 'anon' })));
    assert.throws(() => assertPublishableKey('sb_secret_abc'), (e) => AppError.is(e, 'SECRET_KEY_REJECTED'));
    assert.throws(() => assertPublishableKey(jwt({ role: 'service_role' })), (e) => AppError.is(e, 'SECRET_KEY_REJECTED'));
    assert.throws(() => assertPublishableKey('qualquer-coisa'), (e) => AppError.is(e, 'INVALID_CONNECTION'));
  });

  it('código mf1 do QR faz ida e volta', () => {
    const code = encodeConnectionCode({
      url: 'https://abcd.supabase.co',
      key: 'sb_publishable_abc',
      family: { id: 'f1', name: 'Família Nascimento' },
      by: { name: 'Jhonatan', email: 'j@x.com' },
      pair: 'tokenpar',
      invite: null,
    });
    assert.ok(code.startsWith('mf1.'));
    const decoded = decodeConnectionCode(code);
    assert.equal(decoded.v, 1);
    assert.equal(decoded.family?.name, 'Família Nascimento');
    assert.equal(decoded.pair, 'tokenpar');
  });

  it('código mf1 nunca carrega a chave secreta', () => {
    assert.throws(
      () => encodeConnectionCode({ url: 'https://abcd.supabase.co', key: 'sb_secret_x' }),
      (e) => AppError.is(e, 'SECRET_KEY_REJECTED'),
    );
    const forged = 'mf1.' + base64UrlEncode(JSON.stringify({ v: 1, url: 'https://abcd.supabase.co', key: 'sb_secret_x' }));
    assert.throws(() => decodeConnectionCode(forged), (e) => AppError.is(e, 'SECRET_KEY_REJECTED'));
  });

  it('recusa código inválido ou de versão futura', () => {
    assert.throws(() => decodeConnectionCode('abc'), (e) => AppError.is(e, 'INVALID_CONNECTION'));
    assert.throws(() => decodeConnectionCode('mf1.@@@'), (e) => AppError.is(e, 'INVALID_CONNECTION'));
    const future = 'mf1.' + base64UrlEncode(JSON.stringify({ v: 2, url: 'https://a.supabase.co', key: 'sb_publishable_x' }));
    assert.throws(() => decodeConnectionCode(future), /versão mais nova/);
  });

  it('versão do schema', () => {
    assert.doesNotThrow(() => assertSchemaVersion(MIN_SCHEMA_VERSION));
    assert.throws(() => assertSchemaVersion(null), (e) => AppError.is(e, 'SCHEMA_MISSING'));
    assert.throws(() => assertSchemaVersion(MIN_SCHEMA_VERSION - 1), (e) => AppError.is(e, 'SCHEMA_OUTDATED'));
  });
});
