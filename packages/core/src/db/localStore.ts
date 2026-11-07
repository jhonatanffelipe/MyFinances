import type { DbAdapter } from './adapter';
import type { Clock, IdGenerator, SessionProvider } from '../domain/ports';

/** Tabelas da família que sincronizam com o Supabase, na ordem das FKs (push respeita esta ordem). */
export const SYNCED_TABLES = [
  'categories',
  'credit_cards',
  'fixed_expenses',
  'fixed_expense_payments',
  'movements',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

/**
 * Ponto único de acesso ao SQLite local.
 *
 * Toda escrita passa por `write`: roda numa transação e registra no `_outbox`
 * (via `markDirty`) as linhas alteradas, para o SyncEngine enviar ao Supabase.
 * Ao final, avisa os ouvintes (UI e SyncEngine).
 */
export class LocalStore {
  private readonly listeners = new Set<(tables: SyncedTable[]) => void>();

  constructor(
    readonly db: DbAdapter,
    readonly session: SessionProvider,
    readonly clock: Clock,
    readonly newId: IdGenerator,
  ) {}

  /** Executa escritas numa transação; `ctx.markDirty` coloca a linha na fila de envio. */
  async write<T>(fn: (ctx: WriteContext) => Promise<T>): Promise<T> {
    const touched = new Set<SyncedTable>();
    const result = await this.db.transaction(async (tx) => {
      const ctx = new WriteContext(tx, this.clock, (table) => touched.add(table));
      return fn(ctx);
    });
    if (touched.size > 0) this.emit([...touched]);
    return result;
  }

  /** Assina alterações locais. Retorna a função para cancelar. */
  onChange(listener: (tables: SyncedTable[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Usado pelo SyncEngine quando o pull traz dados de outros membros. */
  emit(tables: SyncedTable[]) {
    for (const listener of this.listeners) {
      try {
        listener(tables);
      } catch {
        // um ouvinte com erro não pode impedir os outros
      }
    }
  }
}

export class WriteContext {
  constructor(
    readonly tx: DbAdapter,
    private readonly clock: Clock,
    private readonly onTouch: (table: SyncedTable) => void,
  ) {}

  now() {
    return this.clock.now();
  }

  /**
   * Registra a linha no outbox. Uma linha alterada várias vezes antes do envio
   * vira uma entrada só (compactação), e o `base_xid` fica com a versão do servidor
   * em que a PRIMEIRA edição local se baseou, para o servidor detectar conflito.
   */
  async markDirty(table: SyncedTable, rowId: string) {
    const now = this.clock.now();
    await this.tx.run(
      `INSERT INTO _outbox (table_name, row_id, base_xid, created_at, updated_at)
       VALUES (?, ?, (SELECT change_xid FROM ${table} WHERE id = ?), ?, ?)
       ON CONFLICT (table_name, row_id) DO UPDATE SET updated_at = excluded.updated_at, attempts = 0, last_error = NULL`,
      [table, rowId, rowId, now, now],
    );
    this.onTouch(table);
  }

  /** Marca várias linhas de uma vez (ex.: lançamentos de um cartão excluído). */
  async markDirtyWhere(table: SyncedTable, where: string, params: (string | number | null)[]) {
    const rows = await this.tx.all<{ id: string }>(`SELECT id FROM ${table} WHERE ${where}`, params);
    for (const row of rows) await this.markDirty(table, row.id);
    return rows.map((r) => r.id);
  }
}
