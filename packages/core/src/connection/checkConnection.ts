import { AppError } from '../errors/AppError';
import { assertSchemaVersion, validateConnection, type SupabaseConnection } from './connection';

/** O mínimo de `fetch` que a verificação usa (Node 18+, Electron, React Native). */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: unknown },
) => Promise<{ status: number; text(): Promise<string> }>;

export interface ConnectionCheckOk {
  connection: SupabaseConnection;
  schemaVersion: number;
}

/** Endereço público usado só para saber se o aparelho tem internet quando o projeto não responde. */
const INTERNET_PROBE = 'https://api.supabase.com/platform/health';

function headersFor(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' };
  // Chave legada (JWT anon) também vai no Authorization; a publishable vai só no apikey
  if (key.split('.').length === 3) headers.authorization = `Bearer ${key}`;
  return headers;
}

async function readJson(res: { text(): Promise<string> }): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/**
 * Valida a conexão na ordem do plano, com uma mensagem para cada falha:
 * 1. formato da URL e da chave (recusa a secreta antes de qualquer rede);
 * 2. projeto acessível (sem internet ≠ URL errada);
 * 3. chave aceita pelo projeto;
 * 4. projeto pausado (plano gratuito);
 * 5. schema instalado (`app_schema_version` existe) e na versão mínima.
 */
export async function checkConnection(
  input: SupabaseConnection,
  fetchFn: FetchLike,
  options: { internetProbe?: () => Promise<boolean> } = {},
): Promise<ConnectionCheckOk> {
  const connection = validateConnection(input);

  let res: { status: number; text(): Promise<string> };
  try {
    res = await fetchFn(`${connection.url}/rest/v1/rpc/app_schema_version`, {
      method: 'POST',
      headers: headersFor(connection.key),
      body: '{}',
    });
  } catch {
    const online = await (options.internetProbe ?? (() => probe(fetchFn)))();
    if (!online) throw new AppError('OFFLINE', 'Sem internet. Conecte-se para configurar o banco pela primeira vez.');
    throw new AppError('INVALID_CONNECTION', 'Não encontramos esse projeto. Confira a Project URL em Project Settings → API.', {
      reason: 'unreachable',
    });
  }

  const body = await readJson(res);
  const message = typeof body === 'string' ? body : `${body?.message ?? ''} ${body?.hint ?? ''}`;

  if (res.status === 540 || /paused|restore/i.test(message)) {
    throw new AppError(
      'PROJECT_PAUSED',
      'O projeto está pausado (plano gratuito pausa após ~7 dias sem uso). Reative em supabase.com/dashboard → Restore.',
    );
  }
  if (res.status === 401 || res.status === 403 || body?.code === 'PGRST301') {
    throw new AppError('INVALID_CONNECTION', 'O projeto recusou a chave. Copie de novo a Publishable key em Project Settings → API.', {
      reason: 'key',
    });
  }
  if (res.status === 404 && (body?.code === 'PGRST202' || /app_schema_version/.test(message))) {
    assertSchemaVersion(null); // SCHEMA_MISSING: rode o setup.sql
  }
  if (res.status >= 500) {
    throw new AppError('OFFLINE', 'O Supabase não respondeu agora. Tente de novo em instantes.', { status: res.status });
  }
  if (res.status !== 200) {
    throw new AppError('INVALID_CONNECTION', `Resposta inesperada do projeto (HTTP ${res.status}).`, { status: res.status });
  }

  const version = Number(body);
  if (!Number.isInteger(version)) {
    throw new AppError('INVALID_CONNECTION', 'Esse endereço não parece ser um projeto Supabase.', { reason: 'not_supabase' });
  }
  assertSchemaVersion(version);
  return { connection, schemaVersion: version };
}

async function probe(fetchFn: FetchLike): Promise<boolean> {
  try {
    await fetchFn(INTERNET_PROBE, { method: 'GET', headers: {} });
    return true;
  } catch {
    return false;
  }
}
