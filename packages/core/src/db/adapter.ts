/**
 * Abstração mínima de acesso ao SQLite. Os repositórios dependem só desta
 * interface: o desktop usa sql.js, o mobile usa expo-sqlite e os testes usam
 * sql.js em memória.
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
  /** Executa o bloco numa transação; desfaz tudo se lançar erro. Transações aninhadas reaproveitam a externa. */
  transaction<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T>;
}
