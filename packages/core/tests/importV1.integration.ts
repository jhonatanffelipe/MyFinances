/**
 * Importação da v1 + sincronização contra o Supabase LOCAL (`yarn db:start`):
 * um banco v1 grande importado no computador chega ao celular de outro membro com os
 * mesmos totais por mês.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import initSqlJs from 'sql.js';
import { AppSession, createSqlJsAdapter, MemoryKeyValueStore, SUPABASE_AUTH_STORAGE_KEY, type AppSupabaseClient, type FetchLike } from '../src/index';
import { createV1Database, v1MonthTotals } from './v1Fixtures';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const SQL = await initSqlJs();
const sessions: AppSession[] = [];
const network = { isOnline: () => true, subscribe: () => () => undefined };

function device(name: string, platform: 'desktop' | 'android') {
  const secure = new MemoryKeyValueStore();
  const session = new AppSession({
    secure,
    network,
    fetch: fetch as unknown as FetchLike,
    createClient: (c) =>
      createClient(c.url, c.key, { auth: { storage: secure, storageKey: SUPABASE_AUTH_STORAGE_KEY, autoRefreshToken: false } }) as unknown as AppSupabaseClient,
    openDatabase: async () => ({ adapter: createSqlJsAdapter(new SQL.Database()), close: () => undefined }),
    device: { name: () => name, platform },
    newId: randomUUID,
  });
  sessions.push(session);
  return session;
}

after(async () => {
  await Promise.all(sessions.map((s) => s.dispose().catch(() => undefined)));
});

describe('importar a v1 e sincronizar', () => {
  it('3 mil lançamentos importados no computador chegam ao celular de outro membro com os mesmos totais', async () => {
    // Banco v1 grande: 24 meses, ~125 lançamentos/mês, valores com centavos
    const v1 = await createV1Database();
    v1.db.run("INSERT INTO credit_cards (description, color, due_day) VALUES ('Nubank', '#8b5cf6', 8)");
    const insert = v1.db.prepare('INSERT INTO movements (description, amount, date, type, category_id, credit_card_id) VALUES (?, ?, ?, ?, ?, ?)');
    const months: string[] = [];
    for (let m = 0; m < 24; m++) {
      const ym = `${2024 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
      months.push(ym);
      for (let i = 0; i < 125; i++) {
        const income = i % 25 === 0;
        insert.run([`Item ${m}-${i}`, Number((((i * 37) % 900) + 0.99 + i / 100).toFixed(2)), `${ym}-${String((i % 28) + 1).padStart(2, '0')}`, income ? 'INCOME' : 'EXPENSE', income ? 3 : (i % 2) + 1, i % 3 === 0 ? 1 : null]);
      }
    }
    insert.free();

    const pc = device('MacBook', 'desktop');
    await pc.init();
    await pc.saveConnection(status.API_URL, status.PUBLISHABLE_KEY);
    await pc.signUp('Ana', `ana-${randomUUID()}@test.local`, 'segredo123');
    await pc.createFamily('Casa Importada');
    const report = await pc.core().importV1.execute.execute(v1.adapter);
    assert.equal(report.imported.movements, 3000);
    const started = Date.now();
    await pc.syncNow();
    while (pc.syncStatus().pending > 0) await pc.syncNow();
    const pushMs = Date.now() - started;
    assert.equal(pc.syncStatus().failed, 0);

    const { code } = await pc.createInvite();
    const phone = device('Galaxy (Android)', 'android');
    await phone.init();
    await phone.useConnectionCode(code);
    await phone.signUp('Beto', `beto-${randomUUID()}@test.local`, 'segredo123');
    const pulled = await phone.core().movements.list.execute({ creditCardId: 'all_ungrouped', perPage: 1 });
    assert.equal(pulled.total, 3000);
    for (const ym of months) {
      const dash = await phone.core().dashboard.get.execute(ym);
      assert.deepEqual({ income: dash.monthIncome, expense: dash.monthExpense }, v1MonthTotals(v1.db, ym), ym);
    }
    console.log(`   envio de 3000 lançamentos + cadastros: ${pushMs} ms`);
  });
});
