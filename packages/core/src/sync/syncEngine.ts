import type { LocalStore, SyncedTable } from '../db/localStore';
import { SYNCED_TABLES } from '../db/localStore';
import type { DbAdapter, SqlParam } from '../db/adapter';
import type { Uuid } from '../domain/types';
import { RemoteError, type PullPage, type PushChange, type RemoteSync } from './remote';

/** Estado da conexão. Desktop: navigator.onLine + ping; mobile: netinfo. */
export interface NetworkMonitor {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export const alwaysOnline: NetworkMonitor = { isOnline: () => true, subscribe: () => () => undefined };

/** Agendador injetável (o core não depende dos tipos de timer do Node nem do DOM). */
export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const g = globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (h: unknown) => void };
export const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => g.setTimeout(fn, ms),
  clearTimeout: (h) => g.clearTimeout(h),
};

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  /** Itens na fila de envio (todas as famílias). */
  pending: number;
  /** Itens que o servidor recusou e esperam ação do usuário. */
  failed: number;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Linhas que foram sobrescritas por outra pessoa no último sync. */
  lastConflicts: number;
  /** Linhas recebidas no pull em andamento (para a barra de progresso da carga inicial). */
  pulledRows: number;
}

export interface SyncReport {
  pushed: number;
  pulled: number;
  conflicts: number;
  rejected: number;
}

export interface SyncEngineOptions {
  pushBatchSize?: number;
  pullPageSize?: number;
  /** Pull periódico enquanto o app está aberto. 0 desliga. */
  intervalMs?: number;
  /** Espera após uma escrita local antes de enviar (junta escritas seguidas). */
  debounceMs?: number;
  maxBackoffMs?: number;
  scheduler?: Scheduler;
}

const TABLE_ORDER: Record<SyncedTable, number> = Object.fromEntries(SYNCED_TABLES.map((t, i) => [t, i])) as Record<SyncedTable, number>;
const BOOLEAN_COLUMNS: Partial<Record<SyncedTable, string[]>> = {
  credit_cards: ['active'],
  fixed_expenses: ['active'],
};
/** Colunas só do SQLite local (não vão para o servidor). */
const LOCAL_ONLY = new Set(['change_xid']);

interface OutboxEntry {
  id: number;
  table_name: SyncedTable;
  row_id: Uuid;
  base_xid: string | null;
  updated_at: string;
}

/**
 * Sincronizador offline-first, independente de plataforma.
 *
 * Ciclo: PUSH (outbox → sync_push, em lotes, na ordem das FKs) e depois PULL
 * (sync_pull paginado desde o cursor xid8 → upsert local). Regras:
 * - pull nunca sobrescreve linha com pendência no outbox (a edição local vence até subir);
 * - recusa do servidor marca só o item culpado (lote é refeito item a item) e segue;
 * - falha de rede para o ciclo e tenta de novo com backoff exponencial;
 * - o cursor só é salvo depois da última página do pull.
 */
export class SyncEngine {
  private readonly opts: Required<Omit<SyncEngineOptions, 'scheduler'>>;
  private readonly scheduler: Scheduler;
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private readonly remoteListeners = new Set<(tables: SyncedTable[]) => void>();
  private status: SyncStatus = {
    phase: 'idle',
    pending: 0,
    failed: 0,
    lastSyncAt: null,
    lastError: null,
    lastConflicts: 0,
    pulledRows: 0,
  };
  private running: Promise<SyncReport> | null = null;
  private rerun = false;
  private started = false;
  private failures = 0;
  private timers = { debounce: null as unknown, retry: null as unknown, interval: null as unknown };
  private unsubscribers: Array<() => void> = [];
  private columnsCache = new Map<string, Set<string>>();

  constructor(
    private readonly store: LocalStore,
    private readonly remote: RemoteSync,
    private readonly network: NetworkMonitor = alwaysOnline,
    options: SyncEngineOptions = {},
  ) {
    this.opts = {
      pushBatchSize: options.pushBatchSize ?? 200,
      pullPageSize: options.pullPageSize ?? 1000,
      intervalMs: options.intervalMs ?? 60_000,
      debounceMs: options.debounceMs ?? 1_000,
      maxBackoffMs: options.maxBackoffMs ?? 5 * 60_000,
    };
    this.scheduler = options.scheduler ?? defaultScheduler;
  }

  private get db(): DbAdapter {
    return this.store.db;
  }

  // ------------------------------------------------------------------ ciclo de vida

  /** Liga os gatilhos: escrita local (debounce), volta da rede, intervalo. Faz um sync já. */
  start() {
    if (this.started) return;
    this.started = true;
    this.unsubscribers.push(
      this.store.onChange(() => this.schedule(this.opts.debounceMs)),
      this.network.subscribe((online) => {
        if (online) this.requestSync();
        else this.setStatus({ phase: 'offline' });
      }),
    );
    this.loop();
    this.requestSync();
  }

  stop() {
    this.started = false;
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    for (const key of Object.keys(this.timers) as Array<keyof typeof this.timers>) {
      if (this.timers[key]) this.scheduler.clearTimeout(this.timers[key]);
      this.timers[key] = null;
    }
  }

  /** Pede um sync (ex.: evento do Realtime avisando que outro membro mudou algo). */
  requestSync() {
    this.schedule(0);
  }

  private schedule(ms: number) {
    if (!this.started) return;
    if (this.timers.debounce) this.scheduler.clearTimeout(this.timers.debounce);
    this.timers.debounce = this.scheduler.setTimeout(() => {
      this.timers.debounce = null;
      this.syncNow().catch(() => undefined);
    }, ms);
  }

  private loop() {
    if (!this.started || !this.opts.intervalMs) return;
    this.timers.interval = this.scheduler.setTimeout(() => {
      this.requestSync();
      this.loop();
    }, this.opts.intervalMs);
  }

  // ------------------------------------------------------------------ status

  onStatus(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Avisa quando o pull trouxe dados de OUTROS aparelhos (a UI recarrega a tela).
   * Diferente de `store.onChange`, não dispara nas gravações locais.
   */
  onRemoteChange(listener: (tables: SyncedTable[]) => void): () => void {
    this.remoteListeners.add(listener);
    return () => {
      this.remoteListeners.delete(listener);
    };
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    for (const l of this.listeners) {
      try {
        l(this.status);
      } catch {
        // ouvinte com erro não derruba o sync
      }
    }
  }

  private async refreshCounts() {
    const row = await this.db.first<{ pending: number; failed: number }>(
      `SELECT COUNT(*) AS pending, COALESCE(SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END), 0) AS failed FROM _outbox`,
    );
    this.setStatus({ pending: Number(row?.pending ?? 0), failed: Number(row?.failed ?? 0) });
  }

  // ------------------------------------------------------------------ sync

  /** Executa push + pull agora. Chamadas simultâneas compartilham o mesmo ciclo. */
  syncNow(): Promise<SyncReport> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.runCycle().finally(() => {
      this.running = null;
      if (this.rerun) {
        this.rerun = false;
        this.requestSync();
      }
    });
    return this.running;
  }

  private async runCycle(): Promise<SyncReport> {
    if (!this.network.isOnline()) {
      this.setStatus({ phase: 'offline' });
      await this.refreshCounts();
      return { pushed: 0, pulled: 0, conflicts: 0, rejected: 0 };
    }
    const familyId = this.store.session.current().familyId;
    this.setStatus({ phase: 'syncing', pulledRows: 0 });
    try {
      const push = await this.push(familyId);
      const pulled = await this.pull(familyId);
      this.failures = 0;
      this.setStatus({ phase: 'idle', lastSyncAt: this.store.clock.now(), lastError: null, lastConflicts: push.conflicts });
      return { ...push, pulled };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof RemoteError && err.kind === 'network') {
        this.failures++;
        const delay = Math.min(2_000 * 2 ** (this.failures - 1), this.opts.maxBackoffMs);
        if (this.started) {
          if (this.timers.retry) this.scheduler.clearTimeout(this.timers.retry);
          this.timers.retry = this.scheduler.setTimeout(() => this.requestSync(), delay);
        }
        this.setStatus({ phase: 'offline', lastError: message });
      } else {
        this.setStatus({ phase: 'error', lastError: message });
      }
      throw err;
    } finally {
      await this.refreshCounts();
    }
  }

  // ------------------------------------------------------------------ push

  private async nextBatch(familyId: Uuid, limit: number): Promise<OutboxEntry[]> {
    // Só itens da família ativa: pendências de outra família esperam ela ser selecionada
    const union = SYNCED_TABLES.map(
      (t) => `SELECT o.id, o.table_name, o.row_id, o.base_xid, o.updated_at, ${TABLE_ORDER[t]} AS ord
              FROM _outbox o JOIN ${t} r ON o.table_name = '${t}' AND r.id = o.row_id
              WHERE o.last_error IS NULL AND r.family_id = ?`,
    ).join(' UNION ALL ');
    return this.db.all<OutboxEntry>(`SELECT * FROM (${union}) ORDER BY ord, id LIMIT ?`, [
      ...SYNCED_TABLES.map(() => familyId),
      limit,
    ]);
  }

  private async toChange(entry: OutboxEntry): Promise<PushChange | null> {
    const row = await this.db.first<Record<string, unknown>>(`SELECT * FROM ${entry.table_name} WHERE id = ?`, [entry.row_id]);
    if (!row) return null;
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (LOCAL_ONLY.has(key)) continue;
      payload[key] = BOOLEAN_COLUMNS[entry.table_name]?.includes(key) ? value === 1 || value === true : value;
    }
    return { table: entry.table_name, row: payload, base_xid: entry.base_xid };
  }

  private async push(familyId: Uuid): Promise<{ pushed: number; conflicts: number; rejected: number }> {
    let pushed = 0;
    let conflicts = 0;
    let rejected = 0;
    for (;;) {
      const batch = await this.nextBatch(familyId, this.opts.pushBatchSize);
      if (batch.length === 0) break;
      const result = await this.pushEntries(familyId, batch);
      pushed += result.pushed;
      conflicts += result.conflicts;
      rejected += result.rejected;
    }
    return { pushed, conflicts, rejected };
  }

  private async pushEntries(familyId: Uuid, entries: OutboxEntry[]): Promise<{ pushed: number; conflicts: number; rejected: number }> {
    const ready: Array<{ entry: OutboxEntry; change: PushChange }> = [];
    for (const entry of entries) {
      const change = await this.toChange(entry);
      if (change) ready.push({ entry, change });
      else await this.db.run('DELETE FROM _outbox WHERE id = ?', [entry.id]); // linha sumiu: nada a enviar
    }
    if (ready.length === 0) return { pushed: 0, conflicts: 0, rejected: 0 };

    try {
      const result = await this.remote.push(familyId, ready.map((r) => r.change));
      await this.acknowledge(familyId, ready.map((r) => r.entry), result.xid, result.conflicts);
      return { pushed: ready.length, conflicts: result.conflicts.length, rejected: 0 };
    } catch (err) {
      if (!(err instanceof RemoteError) || err.kind !== 'rejected') throw err;
      if (ready.length === 1) {
        await this.db.run('UPDATE _outbox SET last_error = ?, attempts = attempts + 1 WHERE id = ?', [err.message, ready[0].entry.id]);
        return { pushed: 0, conflicts: 0, rejected: 1 };
      }
      // Lote recusado: reenvia item a item para isolar o culpado e não travar os outros
      const total = { pushed: 0, conflicts: 0, rejected: 0 };
      for (const { entry } of ready) {
        const r = await this.pushEntries(familyId, [entry]);
        total.pushed += r.pushed;
        total.conflicts += r.conflicts;
        total.rejected += r.rejected;
      }
      return total;
    }
  }

  /** Confirma o envio: tira do outbox (se não mudou durante o push) e grava a versão do servidor. */
  private async acknowledge(familyId: Uuid, entries: OutboxEntry[], xid: string, conflicts: Array<{ table: SyncedTable; id: Uuid }>) {
    const now = this.store.clock.now();
    await this.db.transaction(async (tx) => {
      for (const entry of entries) {
        const removed = await tx.run('DELETE FROM _outbox WHERE id = ? AND updated_at = ?', [entry.id, entry.updated_at]);
        if (removed.changes === 0) {
          // Editada de novo durante o push: continua pendente, agora baseada na versão que subiu
          await tx.run('UPDATE _outbox SET base_xid = ? WHERE id = ?', [xid, entry.id]);
        }
        await tx.run(`UPDATE ${entry.table_name} SET change_xid = ? WHERE id = ?`, [xid, entry.row_id]);
      }
      for (const c of conflicts) {
        await tx.run('INSERT INTO _sync_conflicts (family_id, table_name, row_id, detected_at) VALUES (?, ?, ?, ?)', [
          familyId,
          c.table,
          c.id,
          now,
        ]);
      }
    });
  }

  // ------------------------------------------------------------------ pull

  private async columns(table: string): Promise<Set<string>> {
    let cols = this.columnsCache.get(table);
    if (!cols) {
      const info = await this.db.all<{ name: string }>(`PRAGMA table_info(${table})`);
      cols = new Set(info.map((c) => c.name));
      this.columnsCache.set(table, cols);
    }
    return cols;
  }

  private async pull(familyId: Uuid): Promise<number> {
    const state = await this.db.first<{ cursor: string | null }>('SELECT cursor FROM _sync_state WHERE family_id = ?', [familyId]);
    const cursor = state?.cursor ?? null;
    let page: unknown = null;
    let applied = 0;
    let received = 0;
    const touched = new Set<SyncedTable>();
    let last: PullPage;

    do {
      last = await this.remote.pull(familyId, cursor, page, this.opts.pullPageSize);
      const result = await this.applyPage(familyId, last);
      applied += result.applied;
      received += result.received;
      result.tables.forEach((t) => touched.add(t));
      page = last.page;
      this.setStatus({ pulledRows: received });
    } while (last.has_more);

    await this.db.run(
      `INSERT INTO _sync_state (family_id, cursor, last_pull_at) VALUES (?, ?, ?)
       ON CONFLICT (family_id) DO UPDATE SET cursor = excluded.cursor, last_pull_at = excluded.last_pull_at`,
      [familyId, last.cursor, this.store.clock.now()],
    );
    if (touched.size > 0) {
      this.store.emit([...touched]);
      for (const l of this.remoteListeners) {
        try {
          l([...touched]);
        } catch {
          // ouvinte com erro não derruba o sync
        }
      }
    }
    return applied;
  }

  private async applyPage(familyId: Uuid, page: PullPage): Promise<{ applied: number; received: number; tables: SyncedTable[] }> {
    let applied = 0;
    let received = 0;
    const tables: SyncedTable[] = [];
    await this.db.transaction(async (tx) => {
      const { family, members } = page.changes;
      if (family) {
        await tx.run(
          `INSERT INTO families (id, name, created_by, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET name = excluded.name`,
          [family.id, family.name, family.created_by, family.created_at],
        );
      }
      if (members) {
        await tx.run('DELETE FROM members WHERE family_id = ?', [familyId]);
        for (const m of members) {
          await tx.run('INSERT INTO members (family_id, user_id, role, active, name, avatar_url) VALUES (?, ?, ?, ?, ?, ?)', [
            familyId,
            m.user_id,
            m.role,
            m.active ? 1 : 0,
            m.name,
            m.avatar_url,
          ]);
        }
      }

      for (const table of SYNCED_TABLES) {
        const rows = page.changes[table] ?? [];
        received += rows.length;
        let changedHere = false;
        for (const row of rows) {
          const pending = await tx.first('SELECT 1 FROM _outbox WHERE table_name = ? AND row_id = ?', [table, row.id]);
          if (pending) continue; // a edição local vence até ser enviada
          await this.upsertLocal(tx, table, row);
          applied++;
          changedHere = true;
        }
        if (changedHere) tables.push(table);
      }
    });
    return { applied, received, tables };
  }

  private async upsertLocal(tx: DbAdapter, table: SyncedTable, row: Record<string, any>) {
    if (table === 'categories' && row.deleted_at == null) await this.adoptCategory(tx, row);
    if (table === 'fixed_expense_payments') {
      // Linha local antiga para o mesmo (fixo, mês) com outro id: a do servidor prevalece
      await tx.run('DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ? AND year_month = ? AND id <> ?', [
        row.fixed_expense_id,
        row.year_month,
        row.id,
      ]);
    }
    const cols = [...(await this.columns(table))].filter((c) => c in row);
    const values: SqlParam[] = cols.map((c) => {
      const v = row[c];
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v === undefined) return null;
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    });
    const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
    await tx.run(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values,
    );
  }

  /**
   * Outro membro criou no servidor uma categoria com o mesmo nome e tipo de uma que
   * este aparelho criou offline. As duas não podem coexistir (nome único): a local é
   * absorvida pela do servidor e os lançamentos passam a apontar para ela.
   */
  private async adoptCategory(tx: DbAdapter, row: Record<string, any>) {
    const local = await tx.first<{ id: string }>(
      `SELECT id FROM categories WHERE family_id = ? AND type = ? AND name = ? AND deleted_at IS NULL AND id <> ?`,
      [row.family_id, row.type, row.name, row.id],
    );
    if (!local) return;
    const now = this.store.clock.now();
    for (const t of ['movements', 'fixed_expenses'] as const) {
      const refs = await tx.all<{ id: string }>(`SELECT id FROM ${t} WHERE category_id = ?`, [local.id]);
      if (refs.length === 0) continue;
      await tx.run(`UPDATE ${t} SET category_id = ?, updated_at = ? WHERE category_id = ?`, [row.id, now, local.id]);
      for (const r of refs) {
        await tx.run(
          `INSERT INTO _outbox (table_name, row_id, base_xid, created_at, updated_at)
           VALUES (?, ?, (SELECT change_xid FROM ${t} WHERE id = ?), ?, ?)
           ON CONFLICT (table_name, row_id) DO UPDATE SET updated_at = excluded.updated_at, attempts = 0, last_error = NULL`,
          [t, r.id, r.id, now, now],
        );
      }
    }
    await tx.run("DELETE FROM _outbox WHERE table_name = 'categories' AND row_id = ?", [local.id]);
    await tx.run('DELETE FROM categories WHERE id = ?', [local.id]);
  }

  // ------------------------------------------------------------------ pendências

  /** Itens recusados pelo servidor, para a tela "Pendências de sincronização". */
  listFailed(): Promise<Array<{ id: number; table_name: SyncedTable; row_id: Uuid; last_error: string; attempts: number }>> {
    return this.db.all('SELECT id, table_name, row_id, last_error, attempts FROM _outbox WHERE last_error IS NOT NULL ORDER BY id');
  }

  /** Tenta enviar de novo os itens recusados. */
  async retryFailed(): Promise<void> {
    await this.db.run('UPDATE _outbox SET last_error = NULL WHERE last_error IS NOT NULL');
    this.requestSync();
  }

  /**
   * Descarta a alteração local de um item recusado e baixa de novo a versão do servidor
   * (zera o cursor da família: o próximo pull é completo).
   */
  async discardFailed(outboxId: number): Promise<void> {
    const familyId = this.store.session.current().familyId;
    await this.db.transaction(async (tx) => {
      const entry = await tx.first<OutboxEntry>('SELECT * FROM _outbox WHERE id = ?', [outboxId]);
      if (!entry) return;
      await tx.run('DELETE FROM _outbox WHERE id = ?', [outboxId]);
      // Linha que nunca subiu não existe no servidor: some daqui também
      await tx.run(`DELETE FROM ${entry.table_name} WHERE id = ? AND change_xid IS NULL`, [entry.row_id]);
      await tx.run('UPDATE _sync_state SET cursor = NULL WHERE family_id = ?', [familyId]);
    });
    await this.refreshCounts();
    this.requestSync();
  }
}
