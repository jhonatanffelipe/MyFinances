import { AppError } from '../errors/AppError';
import { base64UrlDecode, base64UrlEncode } from './base64url';

/**
 * Menor versão do schema do Supabase (app_meta.schema_version) que este app aceita.
 * Suba junto com a migração que o app passar a exigir.
 */
export const MIN_SCHEMA_VERSION = 1;

export interface SupabaseConnection {
  url: string;
  /** Publishable key (sb_publishable_...) ou anon key legada (JWT com role anon). */
  key: string;
}

/** Conteúdo do QR "Conectar celular" e do código de convite (prefixo `mf1.`). */
export interface ConnectionCode extends SupabaseConnection {
  v: 1;
  family?: { id: string; name: string };
  by?: { name: string; email: string };
  /** Token de pareamento ("Sou eu"). */
  pair?: string | null;
  /** Token de convite ("Sou outra pessoa"). */
  invite?: string | null;
}

const PREFIX = 'mf1.';

const URL_RE = /^(https?):\/\/([a-z0-9.-]+)(:\d{1,5})?\/?$/i;

/**
 * Normaliza e valida a Project URL. Aceita *.supabase.co e o Supabase local.
 * Usa regex porque o `URL` do React Native não implementa hostname/host.
 */
export function normalizeProjectUrl(raw: string): string {
  const match = raw.trim().match(URL_RE);
  if (!match) throw new AppError('INVALID_CONNECTION', 'URL do projeto inválida (ex.: https://abcd.supabase.co)');
  const [, protocol, hostRaw, port = ''] = match;
  const host = hostRaw.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (!local && protocol.toLowerCase() !== 'https') {
    throw new AppError('INVALID_CONNECTION', 'A URL do projeto precisa começar com https://');
  }
  return `${protocol.toLowerCase()}://${host}${port}`;
}

/** Identificador do projeto (`<ref>` de https://<ref>.supabase.co), usado para nomear o banco local. */
export function projectRef(url: string): string {
  const normalized = normalizeProjectUrl(url);
  const host = normalized.replace(/^https?:\/\//, '');
  const match = host.match(/^([a-z0-9]+)\.supabase\.(co|in)$/);
  return match ? match[1] : host.replace(/[^a-z0-9]+/g, '-');
}

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Aceita só chaves públicas. A secret / service_role ignora o RLS: se ela fosse
 * gravada no app, qualquer um com o arquivo leria o banco inteiro.
 */
export function assertPublishableKey(rawKey: string): string {
  const key = rawKey.trim();
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new AppError(
      'SECRET_KEY_REJECTED',
      'Essa é a chave SECRETA do projeto. Use a Publishable key (Project Settings → API) e nunca compartilhe a secreta.',
    );
  }
  if (key.startsWith('sb_publishable_') || jwtRole(key) === 'anon') return key;
  throw new AppError('INVALID_CONNECTION', 'Chave inválida: copie a Publishable key em Project Settings → API');
}

export function validateConnection(input: SupabaseConnection): SupabaseConnection {
  return { url: normalizeProjectUrl(input.url), key: assertPublishableKey(input.key) };
}

export function encodeConnectionCode(code: Omit<ConnectionCode, 'v'>): string {
  const valid = validateConnection(code);
  return PREFIX + base64UrlEncode(JSON.stringify({ ...code, ...valid, v: 1 }));
}

export function decodeConnectionCode(text: string): ConnectionCode {
  const raw = text.trim();
  if (!raw.startsWith(PREFIX)) throw new AppError('INVALID_CONNECTION', 'Código de conexão inválido');
  let payload: ConnectionCode;
  try {
    payload = JSON.parse(base64UrlDecode(raw.slice(PREFIX.length)));
  } catch {
    throw new AppError('INVALID_CONNECTION', 'Código de conexão corrompido');
  }
  if (payload?.v !== 1) throw new AppError('INVALID_CONNECTION', 'Código de uma versão mais nova do app. Atualize o MyFinances.');
  return { ...payload, ...validateConnection(payload) };
}

/** Compara a versão do schema do servidor com a exigida pelo app. */
export function assertSchemaVersion(serverVersion: number | null): void {
  if (serverVersion === null) {
    throw new AppError('SCHEMA_MISSING', 'O banco ainda não foi preparado: rode o setup.sql no SQL Editor do Supabase');
  }
  if (serverVersion < MIN_SCHEMA_VERSION) {
    throw new AppError('SCHEMA_OUTDATED', `O banco está na versão ${serverVersion} e o app precisa da ${MIN_SCHEMA_VERSION}: rode as migrações novas`, {
      serverVersion,
      required: MIN_SCHEMA_VERSION,
    });
  }
}
