import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RemoteError, SyncEngine, type NetworkMonitor, type PullPage, type RemoteSync, type Scheduler } from '../src/index';
import { ANA, BETO, FAMILY, setupCore } from './helpers';

/** Agendador manual: os timers só disparam quando o teste manda. */
function manualScheduler() {
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let next = 1;
  const scheduler: Scheduler = {
    setTimeout: (fn, ms) => {
      timers.set(next, { fn, ms });
      return next++;
    },
    clearTimeout: (h) => {
      timers.delete(h as number);
    },
  };
  return {
    scheduler,
    delays: () => [...timers.values()].map((t) => t.ms),
    async fire(predicate: (ms: number) => boolean) {
      for (const [id, t] of [...timers]) {
        if (!predicate(t.ms)) continue;
        timers.delete(id);
        t.fn();
      }
      await new Promise((r) => setImmediate(r));
    },
  };
}

function emptyPage(): PullPage {
  return {
    cursor: '10',
    changes: {
      categories: [],
      credit_cards: [],
      fixed_expenses: [],
      fixed_expense_payments: [],
      movements: [],
      family: null,
      members: [
        { user_id: ANA, role: 'OWNER', active: true, name: 'Ana', avatar_url: null },
        { user_id: BETO, role: 'MEMBER', active: true, name: 'Beto', avatar_url: null },
      ],
    },
    has_more: false,
    page: null,
  };
}

function fakeRemote(behavior: { failPush?: () => Error | null } = {}) {
  const calls = { push: 0, pull: 0 };
  const remote: RemoteSync = {
    push: async (_f, changes) => {
      calls.push++;
      const err = behavior.failPush?.();
      if (err) throw err;
      return { applied: changes.length, conflicts: [], xid: '99' };
    },
    pull: async () => {
      calls.pull++;
      return emptyPage();
    },
  };
  return { remote, calls };
}

function network(initial: boolean) {
  let online = initial;
  const listeners = new Set<(o: boolean) => void>();
  const monitor: NetworkMonitor = {
    isOnline: () => online,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return {
    monitor,
    set(value: boolean) {
      online = value;
      listeners.forEach((l) => l(value));
    },
  };
}

describe('SyncEngine (unidade)', () => {
  it('offline não chama o servidor e mostra as pendências', async () => {
    const { core } = await setupCore();
    const { remote, calls } = fakeRemote();
    const net = network(false);
    const engine = new SyncEngine(core.store, remote, net.monitor);
    await core.movements.create.execute({ description: 'x', amount: 1, date: '2026-10-01', type: 'EXPENSE' });
    await engine.syncNow();
    assert.deepEqual(calls, { push: 0, pull: 0 });
    assert.equal(engine.getStatus().phase, 'offline');
    assert.equal(engine.getStatus().pending, 1);
  });

  it('push confirmado limpa o outbox e grava a versão do servidor', async () => {
    const { core, db } = await setupCore();
    const { remote } = fakeRemote();
    const engine = new SyncEngine(core.store, remote);
    const id = await core.movements.create.execute({ description: 'x', amount: 1, date: '2026-10-01', type: 'EXPENSE' });
    const report = await engine.syncNow();
    assert.equal(report.pushed, 1);
    assert.equal(engine.getStatus().pending, 0);
    assert.equal((await db.first('SELECT change_xid FROM movements WHERE id = ?', [id])).change_xid, '99');
    assert.equal((await db.first('SELECT cursor FROM _sync_state WHERE family_id = ?', [FAMILY])).cursor, '10');
  });

  it('falha de rede agenda nova tentativa com backoff exponencial', async () => {
    const { core } = await setupCore();
    const timers = manualScheduler();
    let fail = true;
    const { remote, calls } = fakeRemote({ failPush: () => (fail ? new RemoteError('network', 'sem rede') : null) });
    const engine = new SyncEngine(core.store, remote, undefined, { scheduler: timers.scheduler, intervalMs: 0, debounceMs: 0 });
    await core.movements.create.execute({ description: 'x', amount: 1, date: '2026-10-01', type: 'EXPENSE' });
    engine.start();
    await timers.fire((ms) => ms === 0);
    assert.equal(calls.push, 1);
    assert.ok(timers.delays().includes(2000), 'primeira espera: 2 s');
    await timers.fire((ms) => ms === 2000);
    await timers.fire((ms) => ms === 0);
    assert.ok(timers.delays().includes(4000), 'segunda espera: 4 s');
    fail = false;
    await timers.fire((ms) => ms === 4000);
    await timers.fire((ms) => ms === 0);
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(engine.getStatus().phase, 'idle');
    engine.stop();
  });

  it('escrita local dispara o envio depois do debounce; voltar a rede também', async () => {
    const { core } = await setupCore();
    const timers = manualScheduler();
    const net = network(true);
    const { remote, calls } = fakeRemote();
    const engine = new SyncEngine(core.store, remote, net.monitor, { scheduler: timers.scheduler, intervalMs: 0, debounceMs: 1000 });
    engine.start();
    await timers.fire((ms) => ms === 0);
    const before = calls.pull;
    await core.movements.create.execute({ description: 'x', amount: 1, date: '2026-10-01', type: 'EXPENSE' });
    assert.ok(timers.delays().includes(1000));
    await timers.fire((ms) => ms === 1000);
    assert.equal(calls.push, 1);
    net.set(false);
    assert.equal(engine.getStatus().phase, 'offline');
    net.set(true);
    await timers.fire((ms) => ms === 0);
    assert.ok(calls.pull > before + 1);
    engine.stop();
  });

  it('chamadas simultâneas compartilham o mesmo ciclo', async () => {
    const { core } = await setupCore();
    const { remote, calls } = fakeRemote();
    const engine = new SyncEngine(core.store, remote);
    await Promise.all([engine.syncNow(), engine.syncNow(), engine.syncNow()]);
    assert.equal(calls.pull, 1);
  });
});
