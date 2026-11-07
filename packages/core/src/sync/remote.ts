import type { SyncedTable } from '../db/localStore';
import type { FamilyRole, Uuid } from '../domain/types';

/** Uma linha a enviar. `row` tem as colunas do Postgres; exclusão = deleted_at preenchido. */
export interface PushChange {
  table: SyncedTable;
  row: Record<string, unknown>;
  base_xid: string | null;
}

export interface PushResult {
  applied: number;
  conflicts: Array<{ table: SyncedTable; id: Uuid }>;
  /** Versão (xid8) gravada em todas as linhas deste push. */
  xid: string;
}

export interface PullPage {
  cursor: string;
  changes: Record<SyncedTable, Array<Record<string, any>>> & {
    family: { id: Uuid; name: string; created_by: Uuid | null; created_at: string } | null;
    members: Array<{ user_id: Uuid; role: FamilyRole; active: boolean; name: string; avatar_url: string | null }>;
  };
  has_more: boolean;
  page: unknown;
}

/** Porta para o servidor. A implementação padrão chama as RPCs do Supabase. */
export interface RemoteSync {
  push(familyId: Uuid, changes: PushChange[]): Promise<PushResult>;
  pull(familyId: Uuid, cursor: string | null, page: unknown, limit: number): Promise<PullPage>;
}

/**
 * Tipo de falha, que define o que o SyncEngine faz:
 * - network: sem internet / servidor fora → tenta de novo com backoff;
 * - forbidden: não é mais membro da família → para de sincronizar esta família;
 * - rejected: o servidor recusou o conteúdo (constraint, RLS) → marca o item e segue.
 */
export type RemoteErrorKind = 'network' | 'forbidden' | 'rejected';

export class RemoteError extends Error {
  constructor(
    readonly kind: RemoteErrorKind,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

/** O mínimo do supabase-js que o core usa. Assim o core não depende do pacote em runtime. */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{
    data: any;
    error: { message: string; code?: string; details?: string | null; hint?: string | null } | null;
    status?: number;
  }>;
}

export function classifyRemoteError(error: { message?: string; code?: string } | null | undefined, status?: number): RemoteError {
  const message = error?.message ?? 'Erro desconhecido';
  const code = error?.code ?? '';
  if (/forbidden/i.test(message)) return new RemoteError('forbidden', 'Você não faz mais parte desta família', code);
  // Código SQLSTATE (5 caracteres) ou erro do PostgREST: o servidor recebeu e recusou
  if (/^[0-9A-Z]{5}$/.test(code) || code.startsWith('PGRST')) {
    if (code === 'PGRST301' || code === '42501') return new RemoteError('forbidden', message, code);
    return new RemoteError('rejected', message, code);
  }
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return new RemoteError('rejected', message, code || String(status));
  }
  // fetch falhou, timeout, 5xx, projeto pausado: tenta de novo depois
  return new RemoteError('network', message, code || (status ? String(status) : undefined));
}

/** RemoteSync sobre as RPCs sync_push / sync_pull do Supabase. */
export class SupabaseRemoteSync implements RemoteSync {
  constructor(private readonly client: RpcClient) {}

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try {
      response = await this.client.rpc(fn, args);
    } catch (err) {
      throw new RemoteError('network', err instanceof Error ? err.message : String(err));
    }
    if (response.error) throw classifyRemoteError(response.error, response.status);
    return response.data as T;
  }

  push(familyId: Uuid, changes: PushChange[]): Promise<PushResult> {
    return this.call('sync_push', { p_family_id: familyId, p_changes: changes });
  }

  pull(familyId: Uuid, cursor: string | null, page: unknown, limit: number): Promise<PullPage> {
    return this.call('sync_pull', { p_family_id: familyId, p_cursor: cursor, p_page: page ?? null, p_limit: limit });
  }
}
