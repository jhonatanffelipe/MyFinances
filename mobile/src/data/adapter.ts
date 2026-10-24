/**
 * Abstração mínima de acesso ao SQLite. Os repositórios dependem só desta
 * interface, então a mesma lógica roda no app (expo-sqlite) e nos testes (sql.js).
 */
export type SqlParam = string | number | null;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface DbAdapter {
  all<T = any>(sql: string, params?: SqlParam[]): Promise<T[]>;
  first<T = any>(sql: string, params?: SqlParam[]): Promise<T | null>;
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  /** Executa o bloco numa transação; desfaz tudo se lançar erro. */
  transaction<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T>;
}
