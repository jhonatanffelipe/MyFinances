import type { DbAdapter, SqlParam } from './adapter';

/**
 * O que o adaptador usa do `SQLiteDatabase` do expo-sqlite. Tipado aqui de forma
 * estrutural para o core não depender do expo (o mobile passa o banco aberto).
 */
export interface ExpoSqliteDatabaseLike {
  getAllAsync(sql: string, params: SqlParam[]): Promise<unknown[]>;
  getFirstAsync(sql: string, params: SqlParam[]): Promise<unknown>;
  runAsync(sql: string, params: SqlParam[]): Promise<{ lastInsertRowId: number; changes: number }>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * DbAdapter sobre o expo-sqlite, com a mesma semântica de conexão única do sql.js
 * (com que o core é testado):
 *
 * - Escritas e transações passam por uma fila: nunca há duas transações ao mesmo tempo
 *   e uma escrita solta não cai no meio da transação de outro fluxo (ex.: sync × usuário).
 * - Leituras não esperam a fila (WAL: leem o último estado confirmado ou o da transação).
 * - Transação aninhada reaproveita a externa (o SQLite não aninha).
 *
 * Não usa `withExclusiveTransactionAsync`: ele abre outra conexão e concorre pelo lock
 * do arquivo ("database is locked") com a conexão principal.
 */
export function createExpoSqliteAdapter(db: ExpoSqliteDatabaseLike): DbAdapter {
  let queue: Promise<unknown> = Promise.resolve();

  /** Enfileira `task` depois de tudo o que já está na fila (erros não travam a fila). */
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task, task);
    queue = result.catch(() => undefined);
    return result;
  };

  const reads = {
    all: <T>(sql: string, params: SqlParam[] = []) => db.getAllAsync(sql, params) as Promise<T[]>,
    first: async <T>(sql: string, params: SqlParam[] = []) => ((await db.getFirstAsync(sql, params)) ?? null) as T | null,
  };

  /** Adaptador usado DENTRO de uma transação: já está com a fila, então não enfileira de novo. */
  const inTransaction: DbAdapter = {
    ...reads,
    run: (sql, params = []) => db.runAsync(sql, params),
    exec: (sql) => db.execAsync(sql),
    transaction: (fn) => fn(inTransaction),
  };

  return {
    ...reads,
    run: (sql, params = []) => enqueue(() => db.runAsync(sql, params)),
    exec: (sql) => enqueue(() => db.execAsync(sql)),
    transaction: <T>(fn: (tx: DbAdapter) => Promise<T>) =>
      enqueue(async () => {
        let result!: T;
        await db.withTransactionAsync(async () => {
          result = await fn(inTransaction);
        });
        return result;
      }),
  };
}
