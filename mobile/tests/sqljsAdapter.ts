import type { Database } from 'sql.js';
import { DbAdapter, SqlParam } from '../src/data/adapter';

/** Adaptador sql.js usado apenas nos testes da camada de dados (Node). */
export function createSqlJsAdapter(db: Database): DbAdapter {
  const all = async (sql: string, params: SqlParam[] = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params as any);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };
  let depth = 0;
  const adapter: DbAdapter = {
    all,
    first: async (sql, params = []) => (await all(sql, params))[0] ?? null,
    run: async (sql, params = []) => {
      db.run(sql, params as any);
      const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0] as number;
      return { lastInsertRowId: id, changes: db.getRowsModified() };
    },
    exec: async (sql) => {
      db.exec(sql);
    },
    transaction: async (fn) => {
      if (depth > 0) return fn(adapter);
      depth++;
      db.run('BEGIN');
      try {
        const r = await fn(adapter);
        db.run('COMMIT');
        return r;
      } catch (e) {
        db.run('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
  };
  return adapter;
}
