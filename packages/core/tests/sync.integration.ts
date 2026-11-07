/**
 * Testes de convergência do SyncEngine contra o Supabase LOCAL (yarn core:test:sync).
 * Requer `yarn db:start`. Cada "aparelho" é um SQLite em memória com o próprio core,
 * sessão e cliente Supabase autenticado — o mesmo caminho do app, sem service_role.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import initSqlJs from 'sql.js';
import {
  createCore,
  createSqlJsAdapter,
  MemorySessionProvider,
  RemoteError,
  SupabaseRemoteSync,
  SyncEngine,
  type Core,
  type PushChange,
  type RemoteSync,
} from '../src/index';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const API: string = status.API_URL;
const KEY: string = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const DB_URL: string = status.DB_URL;

interface User {
  id: string;
  client: SupabaseClient;
}

let ana: User;
let beto: User;
let familyId: string;
let sql: pg.Client;

async function signUp(name: string): Promise<User> {
  const client = createClient(API, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `${name}-${randomUUID()}@test.local`, password: 'senha1234', options: { data: { name } } });
  if (error || !data.user) throw error ?? new Error('signup falhou');
  return { id: data.user.id, client };
}

interface Device {
  core: Core;
  engine: SyncEngine;
  session: MemorySessionProvider;
}

async function device(user: User, options: { remote?: RemoteSync; pullPageSize?: number } = {}): Promise<Device> {
  const SQL = await initSqlJs();
  const session = new MemorySessionProvider();
  session.set({ userId: user.id, familyId });
  const core = await createCore({ db: createSqlJsAdapter(new SQL.Database()), session, newId: randomUUID });
  const engine = new SyncEngine(core.store, options.remote ?? new SupabaseRemoteSync(user.client), undefined, {
    pullPageSize: options.pullPageSize,
  });
  await engine.syncNow(); // carga inicial: família e membros
  return { core, engine, session };
}

/** Estado visível (linhas vivas) para comparar dois aparelhos. */
async function snapshot(d: Device) {
  const db = d.core.store.db;
  return {
    categories: await db.all('SELECT id, name, type FROM categories WHERE family_id = ? AND deleted_at IS NULL ORDER BY id', [familyId]),
    cards: await db.all('SELECT id, description, active FROM credit_cards WHERE family_id = ? AND deleted_at IS NULL ORDER BY id', [familyId]),
    movements: await db.all(
      'SELECT id, description, amount, date, type, member_id, to_member_id, category_id, credit_card_id FROM movements WHERE family_id = ? AND deleted_at IS NULL ORDER BY id',
      [familyId],
    ),
    payments: await db.all('SELECT id, fixed_expense_id, year_month FROM fixed_expense_payments WHERE family_id = ? AND deleted_at IS NULL ORDER BY id', [familyId]),
  };
}

const serverCount = async (where: string, params: unknown[] = []) =>
  Number((await sql.query(`SELECT count(*) AS n FROM public.movements WHERE family_id = $1 AND ${where}`, [familyId, ...params])).rows[0].n);

before(async () => {
  sql = new pg.Client({ connectionString: DB_URL });
  await sql.connect();
  ana = await signUp('Ana');
  beto = await signUp('Beto');
  const fam = await ana.client.rpc('create_family', { p_name: 'Família Sync' });
  assert.ifError(fam.error);
  familyId = fam.data;
  const invite = await ana.client.rpc('create_family_invite', { p_family_id: familyId });
  assert.ifError(invite.error);
  const accept = await beto.client.rpc('accept_family_invite', { p_token: invite.data });
  assert.ifError(accept.error);
});

after(async () => {
  await sql.end();
});

describe('SyncEngine contra o Supabase local', () => {
  it('carga inicial traz família e membros', async () => {
    const a = await device(ana);
    const members = await a.core.repos.families.listMembers(familyId);
    assert.deepEqual(members.map((m) => m.name).sort(), ['Ana', 'Beto']);
  });

  it('criações offline nos dois aparelhos convergem', async () => {
    const a = await device(ana);
    const b = await device(beto);
    const cat = await a.core.categories.create.execute({ name: `Mercado ${randomUUID()}`, type: 'EXPENSE' });
    const card = await a.core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    await a.core.movements.create.execute({ description: 'Feira', amount: 80, date: '2026-10-03', type: 'EXPENSE', category_id: cat, credit_card_id: card });
    await b.core.movements.create.execute({ description: 'Padaria', amount: 12.5, date: '2026-10-04', type: 'EXPENSE' });
    await b.core.movements.create.execute({ description: 'Mesada', amount: 50, date: '2026-10-05', type: 'TRANSFER', to_member_id: ana.id });

    const ra = await a.engine.syncNow();
    assert.equal(ra.pushed, 3);
    await b.engine.syncNow();
    await a.engine.syncNow();

    assert.deepEqual(await snapshot(a), await snapshot(b));
    assert.equal((await snapshot(a)).movements.length >= 3, true);
    assert.equal(a.engine.getStatus().pending, 0);
    assert.equal(b.engine.getStatus().pending, 0);
  });

  it('mesma linha editada nos dois offline: o último push vence e o conflito é registrado', async () => {
    const a = await device(ana);
    const id = await a.core.movements.create.execute({ description: 'Original', amount: 10, date: '2026-10-10', type: 'EXPENSE' });
    await a.engine.syncNow();
    const b = await device(beto);

    await a.core.movements.update.execute(id, { description: 'Versão da Ana', amount: 11, date: '2026-10-10', type: 'EXPENSE' });
    await b.core.movements.update.execute(id, { description: 'Versão do Beto', amount: 12, date: '2026-10-10', type: 'EXPENSE', member_id: ana.id });

    const first = await a.engine.syncNow();
    assert.equal(first.conflicts, 0, 'a Ana editou a partir da versão atual');
    const second = await b.engine.syncNow();
    assert.equal(second.conflicts, 1, 'o Beto editou a partir de uma versão velha');
    assert.equal(b.engine.getStatus().lastConflicts, 1);
    await a.engine.syncNow();

    assert.equal((await a.core.movements.get.execute(id)).description, 'Versão do Beto');
    assert.deepEqual(await snapshot(a), await snapshot(b));
    const log = await sql.query('SELECT overwritten ->> $2 AS description FROM public.sync_conflicts WHERE row_id = $1', [id, 'description']);
    assert.equal(log.rows[0].description, 'Versão da Ana', 'a versão sobrescrita fica no histórico');
  });

  it('editar logo depois do próprio push não gera conflito falso', async () => {
    const a = await device(ana);
    const id = await a.core.movements.create.execute({ description: 'v1', amount: 10, date: '2026-10-11', type: 'EXPENSE' });
    await a.engine.syncNow();
    await a.core.movements.update.execute(id, { description: 'v2', amount: 10, date: '2026-10-11', type: 'EXPENSE' });
    const r = await a.engine.syncNow();
    assert.equal(r.conflicts, 0);
  });

  it('exclusão em A e edição em B: se B sobe depois, a linha volta (comportamento esperado)', async () => {
    const a = await device(ana);
    const id = await a.core.movements.create.execute({ description: 'Disputado', amount: 30, date: '2026-10-12', type: 'EXPENSE' });
    await a.engine.syncNow();
    const b = await device(beto);
    await a.core.movements.remove.execute(id);
    await b.core.movements.update.execute(id, { description: 'Editado pelo Beto', amount: 30, date: '2026-10-12', type: 'EXPENSE', member_id: ana.id });
    await a.engine.syncNow();
    const r = await b.engine.syncNow();
    assert.equal(r.conflicts, 1);
    await a.engine.syncNow();
    assert.equal((await a.core.movements.get.execute(id)).description, 'Editado pelo Beto');
  });

  it('exclusão sincroniza como tombstone', async () => {
    const a = await device(ana);
    const id = await a.core.movements.create.execute({ description: 'Vai sumir', amount: 5, date: '2026-10-13', type: 'EXPENSE' });
    await a.engine.syncNow();
    const b = await device(beto);
    assert.ok(await b.core.repos.movements.findById(id));
    await a.core.movements.remove.execute(id);
    await a.engine.syncNow();
    await b.engine.syncNow();
    assert.equal(await b.core.repos.movements.findById(id), null);
  });

  it('transação aberta no servidor durante o pull não faz o cliente perder a linha (cursor xid8)', async () => {
    const a = await device(ana);
    const pending = new pg.Client({ connectionString: DB_URL });
    await pending.connect();
    const id = randomUUID();
    try {
      await pending.query('BEGIN');
      await pending.query(
        `INSERT INTO public.movements (id, family_id, member_id, created_by, description, amount, date, type)
         VALUES ($1, $2, $3, $3, 'Gravado em transação lenta', 42, '2026-10-14', 'EXPENSE')`,
        [id, familyId, beto.id],
      );
      // Outra escrita confirmada DEPOIS que a transação lenta começou
      await sql.query(
        `INSERT INTO public.movements (family_id, member_id, created_by, description, amount, date, type)
         VALUES ($1, $2, $2, 'Gravado rápido', 1, '2026-10-14', 'EXPENSE')`,
        [familyId, beto.id],
      );
      await a.engine.syncNow();
      assert.equal(await a.core.repos.movements.findById(id), null, 'ainda não confirmada');
      await pending.query('COMMIT');
    } finally {
      await pending.end();
    }
    await a.engine.syncNow();
    assert.ok(await a.core.repos.movements.findById(id), 'chega no pull seguinte mesmo tendo xid menor que escritas já vistas');
  });

  it('app fechado no meio do push: reenviar não duplica nem perde nada', async () => {
    const real = new SupabaseRemoteSync(ana.client);
    let crash = true;
    const flaky: RemoteSync = {
      pull: (...args) => real.pull(...args),
      push: async (fam: string, changes: PushChange[]) => {
        const result = await real.push(fam, changes);
        if (crash) {
          crash = false;
          throw new RemoteError('network', 'conexão caiu antes da resposta');
        }
        return result;
      },
    };
    const a = await device(ana, { remote: flaky });
    const tag = randomUUID();
    await a.core.movements.create.execute({ description: `Crash ${tag}`, amount: 7, date: '2026-10-15', type: 'EXPENSE' });
    await assert.rejects(a.engine.syncNow(), (e) => e instanceof RemoteError && e.kind === 'network');
    assert.equal(a.engine.getStatus().pending, 1, 'continua na fila');
    await a.engine.syncNow();
    assert.equal(a.engine.getStatus().pending, 0);
    assert.equal(await serverCount('description = $2', [`Crash ${tag}`]), 1);
  });

  it('pull repetido é idempotente e não cria pendências', async () => {
    const a = await device(ana);
    const before = await snapshot(a);
    await a.core.store.db.run('UPDATE _sync_state SET cursor = NULL');
    await a.engine.syncNow();
    await a.engine.syncNow();
    assert.deepEqual(await snapshot(a), before);
    assert.equal(a.engine.getStatus().pending, 0);
  });

  it('carga inicial grande vem paginada e completa', async () => {
    await sql.query(
      `INSERT INTO public.movements (family_id, member_id, created_by, description, amount, date, type)
       SELECT $1, $2, $2, 'Lote ' || g, 1, date '2025-01-01' + (g % 300), 'EXPENSE' FROM generate_series(1, 2500) g`,
      [familyId, ana.id],
    );
    const total = await serverCount('deleted_at IS NULL');
    let pages = 0;
    const real = new SupabaseRemoteSync(beto.client);
    const counting: RemoteSync = {
      push: (...args) => real.push(...args),
      pull: async (...args) => {
        pages++;
        return real.pull(...args);
      },
    };
    const b = await device(beto, { remote: counting, pullPageSize: 1000 });
    assert.ok(pages >= 3, `usou ${pages} páginas`);
    assert.equal((await snapshot(b)).movements.length, total);
  });

  it('baixa do mesmo fixo no mesmo mês em dois aparelhos offline não colide', async () => {
    const a = await device(ana);
    const fixedId = await a.core.fixedExpenses.create.execute({ description: 'Luz', amount: 200, due_day: 10, start_date: '2026-01-01' });
    await a.engine.syncNow();
    const b = await device(beto);
    await a.core.fixedExpenses.setPaid.execute(fixedId, '2026-10', true);
    await b.core.fixedExpenses.setPaid.execute(fixedId, '2026-10', true);
    await a.engine.syncNow();
    const r = await b.engine.syncNow();
    assert.equal(r.rejected, 0);
    await a.engine.syncNow();
    assert.deepEqual((await snapshot(a)).payments, (await snapshot(b)).payments);
    assert.equal((await snapshot(a)).payments.filter((p) => p.fixed_expense_id === fixedId).length, 1);
  });

  it('mesma categoria criada offline nos dois: o segundo aparelho adota a do servidor', async () => {
    const a = await device(ana);
    const b = await device(beto);
    const name = `Pet ${randomUUID()}`;
    await a.core.categories.create.execute({ name, type: 'EXPENSE' });
    const catB = await b.core.categories.create.execute({ name, type: 'EXPENSE' });
    const movB = await b.core.movements.create.execute({ description: 'Ração', amount: 90, date: '2026-10-16', type: 'EXPENSE', category_id: catB });
    await a.engine.syncNow();
    const r = await b.engine.syncNow();
    assert.ok(r.rejected >= 1, 'o push da categoria duplicada (e do lançamento que depende dela) é recusado...');
    // ...mas o pull adota a categoria do servidor, reaponta o lançamento e o devolve à fila
    assert.deepEqual(await b.engine.listFailed(), []);
    await b.engine.syncNow();
    await a.engine.syncNow();
    const mov = await b.core.movements.get.execute(movB);
    assert.equal(mov.category_name, name);
    assert.notEqual(mov.category_id, catB);
    assert.deepEqual(await snapshot(a), await snapshot(b));
    assert.equal(b.engine.getStatus().failed, 0);
  });

  it('item recusado pelo servidor não trava os outros', async () => {
    const a = await device(ana);
    const ok = await a.core.movements.create.execute({ description: 'Válido', amount: 3, date: '2026-10-17', type: 'EXPENSE' });
    // Lançamento em nome de quem não é da família (burlando a validação local)
    const bad = randomUUID();
    await a.core.store.write(async (ctx) => {
      await ctx.tx.run(
        `INSERT INTO movements (id, family_id, member_id, created_by, description, amount, date, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'Inválido', 1, '2026-10-17', 'EXPENSE', ?, ?)`,
        [bad, familyId, randomUUID(), ana.id, ctx.now(), ctx.now()],
      );
      await ctx.markDirty('movements', bad);
    });
    const r = await a.engine.syncNow();
    assert.equal(r.rejected, 1);
    assert.equal(await serverCount('id = $2', [ok]), 1);
    const failed = await a.engine.listFailed();
    assert.equal(failed.length, 1);
    assert.equal(failed[0].row_id, bad);
    await a.engine.discardFailed(failed[0].id);
    await a.engine.syncNow();
    assert.equal(a.engine.getStatus().failed, 0);
    assert.equal(await a.core.repos.movements.findById(bad), null);
  });

  it('Realtime: membro recebe o evento, outra família não', async () => {
    const caio = await signUp('Caio');
    const other = await caio.client.rpc('create_family', { p_name: 'Família do Caio' });
    assert.ifError(other.error);

    const listen = (user: User) => {
      const events: string[] = [];
      const channel = user.client
        .channel(`rt-${randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, (payload) => {
          events.push((payload.new as { description?: string })?.description ?? '');
        });
      const ready = new Promise<void>((resolve, reject) => {
        channel.subscribe((s) => {
          if (s === 'SUBSCRIBED') resolve();
          if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') reject(new Error(`realtime ${s}`));
        });
      });
      return { events, channel, ready };
    };

    const betoRt = listen(beto);
    const caioRt = listen(caio);
    await Promise.all([betoRt.ready, caioRt.ready]);

    // Logo depois de um `supabase db reset` o Realtime leva um tempo para religar a
    // replicação: insere uma linha de sondagem até o primeiro evento chegar (máx. 90 s).
    const warmUntil = Date.now() + 90_000;
    while (betoRt.events.length === 0 && Date.now() < warmUntil) {
      await sql.query(
        `INSERT INTO public.movements (family_id, member_id, created_by, description, amount, date, type)
         VALUES ($1, $2, $2, 'sondagem realtime', 1, '2026-10-18', 'EXPENSE')`,
        [familyId, ana.id],
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
    assert.ok(betoRt.events.length > 0, 'Realtime não ficou pronto em 90 s');

    const tag = `Realtime ${randomUUID()}`;
    const a = await device(ana);
    await a.core.movements.create.execute({ description: tag, amount: 9, date: '2026-10-18', type: 'EXPENSE' });
    await a.engine.syncNow();

    const deadline = Date.now() + 10000;
    while (!betoRt.events.includes(tag) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 500));
    await beto.client.removeChannel(betoRt.channel);
    await caio.client.removeChannel(caioRt.channel);

    assert.ok(betoRt.events.includes(tag), 'membro da família recebe');
    assert.ok(!caioRt.events.includes(tag), 'outra família não recebe');
  });

  it('membro desativado para de sincronizar com erro claro', async () => {
    const b = await device(beto);
    const off = await ana.client.rpc('set_member_active', { p_family_id: familyId, p_user_id: beto.id, p_active: false });
    assert.ifError(off.error);
    await assert.rejects(b.engine.syncNow(), (e) => e instanceof RemoteError && e.kind === 'forbidden');
    assert.equal(b.engine.getStatus().phase, 'error');
    await ana.client.rpc('set_member_active', { p_family_id: familyId, p_user_id: beto.id, p_active: true });
  });
});
