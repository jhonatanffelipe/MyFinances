import { randomUUID } from 'node:crypto';
import initSqlJs from 'sql.js';
import { createCore, createSqlJsAdapter, MemorySessionProvider, type Clock } from '../src/index';

export const FAMILY = '11111111-1111-4111-8111-111111111111';
export const OTHER_FAMILY = '22222222-2222-4222-8222-222222222222';
export const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const BETO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const CAIO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

/** Relógio controlável: cada chamada avança 1 ms para os updated_at serem distintos. */
export function fakeClock(start = '2026-11-07T12:00:00.000Z', today = '2026-11-07'): Clock {
  let t = Date.parse(start);
  return { now: () => new Date(t++).toISOString(), today: () => today };
}

/**
 * Core sobre um SQLite em memória com duas famílias: Ana e Beto na FAMILY,
 * Caio na OTHER_FAMILY. A sessão começa como Ana na FAMILY.
 */
export async function setupCore() {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const db = createSqlJsAdapter(raw);
  const session = new MemorySessionProvider();
  session.set({ userId: ANA, familyId: FAMILY });
  const core = await createCore({ db, session, clock: fakeClock(), newId: randomUUID });

  await core.store.write(async (ctx) => {
    for (const [id, name] of [[FAMILY, 'Família Teste'], [OTHER_FAMILY, 'Outra Família']]) {
      await core.repos.families.upsertFamily(ctx, { id, name, created_by: ANA, created_at: ctx.now() });
    }
    await core.repos.families.replaceMembers(ctx, FAMILY, [
      { family_id: FAMILY, user_id: ANA, role: 'OWNER', active: true, name: 'Ana', avatar_url: null },
      { family_id: FAMILY, user_id: BETO, role: 'MEMBER', active: true, name: 'Beto', avatar_url: null },
    ]);
    await core.repos.families.replaceMembers(ctx, OTHER_FAMILY, [
      { family_id: OTHER_FAMILY, user_id: CAIO, role: 'OWNER', active: true, name: 'Caio', avatar_url: null },
    ]);
  });
  return { core, db, raw, session };
}

export async function outbox(db: { all: (sql: string) => Promise<any[]> }) {
  return db.all('SELECT table_name, row_id, base_xid FROM _outbox ORDER BY id');
}
