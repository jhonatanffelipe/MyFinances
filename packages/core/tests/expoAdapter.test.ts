import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import initSqlJs from 'sql.js';
import { createCore, createExpoSqliteAdapter, MemorySessionProvider, type ExpoSqliteDatabaseLike, type SqlParam } from '../src/index';
import { ANA, FAMILY } from './helpers';

/**
 * Imitação do SQLiteDatabase do expo-sqlite sobre sql.js, com as mesmas armadilhas:
 * tudo é assíncrono e withTransactionAsync NÃO impede que outra chamada caia no meio.
 */
async function fakeExpoDb() {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const tick = () => new Promise((r) => setImmediate(r));
  const rows = (sql: string, params: SqlParam[]) => {
    const stmt = raw.prepare(sql);
    stmt.bind(params as any);
    const out: unknown[] = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  };
  let inTx = false;
  const db: ExpoSqliteDatabaseLike = {
    getAllAsync: async (sql, params) => (await tick(), rows(sql, params)),
    getFirstAsync: async (sql, params) => (await tick(), rows(sql, params)[0] ?? null),
    runAsync: async (sql, params) => {
      await tick();
      raw.run(sql, params as any);
      return { lastInsertRowId: 0, changes: raw.getRowsModified() };
    },
    execAsync: async (sql) => {
      await tick();
      raw.exec(sql);
    },
    withTransactionAsync: async (task) => {
      if (inTx) throw new Error('cannot start a transaction within a transaction');
      inTx = true;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      } finally {
        inTx = false;
      }
    },
  };
  return { db, raw };
}

describe('adaptador expo-sqlite', () => {
  it('serializa transações concorrentes e desfaz a que falha', async () => {
    const { db, raw } = await fakeExpoDb();
    const adapter = createExpoSqliteAdapter(db);
    await adapter.exec('CREATE TABLE t (v INTEGER)');
    const slow = adapter.transaction(async (tx) => {
      await tx.run('INSERT INTO t VALUES (1)');
      await new Promise((r) => setTimeout(r, 20));
      await tx.run('INSERT INTO t VALUES (2)');
    });
    const failing = adapter.transaction(async (tx) => {
      await tx.run('INSERT INTO t VALUES (99)');
      throw new Error('falhou');
    });
    const loose = adapter.run('INSERT INTO t VALUES (3)'); // não pode cair dentro de outra transação
    await slow;
    await assert.rejects(failing, /falhou/);
    await loose;
    assert.deepEqual(raw.exec('SELECT v FROM t ORDER BY v')[0].values.flat(), [1, 2, 3]);
  });

  it('transação aninhada reaproveita a externa', async () => {
    const { db } = await fakeExpoDb();
    const adapter = createExpoSqliteAdapter(db);
    await adapter.exec('CREATE TABLE t (v INTEGER)');
    await adapter.transaction((tx) => tx.transaction((inner) => inner.run('INSERT INTO t VALUES (1)')));
    assert.equal((await adapter.first<{ n: number }>('SELECT COUNT(*) AS n FROM t'))?.n, 1);
  });

  it('o core inteiro roda sobre ele (migração + escrita com outbox)', async () => {
    const { db } = await fakeExpoDb();
    const session = new MemorySessionProvider();
    session.set({ userId: ANA, familyId: FAMILY });
    const core = await createCore({ db: createExpoSqliteAdapter(db), session, newId: randomUUID });
    await core.store.write((ctx) => core.repos.families.upsertFamily(ctx, { id: FAMILY, name: 'F', created_by: ANA, created_at: ctx.now() }));
    await core.store.write((ctx) =>
      core.repos.families.replaceMembers(ctx, FAMILY, [{ family_id: FAMILY, user_id: ANA, role: 'OWNER', active: true, name: 'Ana', avatar_url: null }]),
    );
    const ids = await Promise.all(
      [1, 2, 3].map((i) => core.movements.create.execute({ description: `m${i}`, amount: i, date: '2026-10-01', type: 'EXPENSE' })),
    );
    assert.equal(new Set(ids).size, 3);
    assert.equal((await core.movements.list.execute({ creditCardId: 'all_ungrouped' })).total, 3);
  });
});
