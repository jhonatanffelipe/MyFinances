import type { Database } from 'sql.js';
import type { DbAdapter, SqlParam } from './adapter';

/**
 * DbAdapter sobre um `Database` do sql.js (desktop e testes). A persistência em
 * arquivo fica com quem cria o banco: o adaptador avisa cada escrita por `onWrite`.
 */
export function createSqlJsAdapter(db: Database, options: { onWrite?: () => void } = {}): DbAdapter {
  let depth = 0;

  const all = async (sql: string, params: SqlParam[] = []) => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as any);
      const rows: any[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  };

  const notify = () => {
    if (depth === 0) options.onWrite?.();
  };

  const adapter: DbAdapter = {
    all,
    first: async (sql, params = []) => (await all(sql, params))[0] ?? null,
    run: async (sql, params = []) => {
      db.run(sql, params as any);
      const changes = db.getRowsModified();
      const id = db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0] as number;
      notify();
      return { lastInsertRowId: id ?? 0, changes };
    },
    exec: async (sql) => {
      db.exec(sql);
      notify();
    },
    transaction: async (fn) => {
      if (depth > 0) return fn(adapter);
      depth++;
      db.run('BEGIN');
      try {
        const result = await fn(adapter);
        db.run('COMMIT');
        return result;
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      } finally {
        depth--;
        notify();
      }
    },
  };
  return adapter;
}
