import type { SQLiteDatabase } from 'expo-sqlite';
import { DbAdapter, SqlParam } from './adapter';

/** Implementação do DbAdapter sobre o expo-sqlite. */
export function createExpoAdapter(db: SQLiteDatabase): DbAdapter {
  const wrap = (
    conn: Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync' | 'execAsync'>,
    inTransaction: boolean
  ): DbAdapter => ({
    all: (sql, params: SqlParam[] = []) => conn.getAllAsync(sql, params) as Promise<any[]>,
    first: (sql, params: SqlParam[] = []) => conn.getFirstAsync(sql, params) as Promise<any>,
    run: async (sql, params: SqlParam[] = []) => {
      const res = await conn.runAsync(sql, params);
      return { lastInsertRowId: res.lastInsertRowId, changes: res.changes };
    },
    exec: (sql) => conn.execAsync(sql),
    transaction: async (fn) => {
      // Dentro de uma transação, reaproveita a mesma (o SQLite não aninha transações)
      if (inTransaction) return fn(wrap(conn, true));
      let result: any;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(wrap(txn, true));
      });
      return result;
    },
  });
  return wrap(db, false);
}
