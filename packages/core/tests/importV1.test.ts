import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../src/index';
import { ANA, BETO, FAMILY, setupCore } from './helpers';
import { createV1Database, seedV1, v1MonthTotals } from './v1Fixtures';

async function familyWithDefaults() {
  const ctx = await setupCore();
  await ctx.core.categories.seedDefaults.execute();
  return ctx;
}

describe('importar o banco da v1', () => {
  for (const legacy of [false, true]) {
    it(`banco v1 ${legacy ? 'ANTIGO (sem as colunas novas)' : 'atual'}: totais por mês da v1 = família na v2`, async () => {
      const v1 = await createV1Database({ legacy });
      seedV1(v1.db, { legacy });
      const { core } = await familyWithDefaults();

      const preview = await core.importV1.preview.execute(v1.adapter);
      assert.equal(preview.movements, 12);
      assert.deepEqual(preview.period, { start: '2025-08-05', end: '2025-10-20' });
      assert.equal(preview.missingColumns.length > 0, legacy);

      const steps = new Set<string>();
      const report = await core.importV1.execute.execute(v1.adapter, { onProgress: (p) => steps.add(p.step) });
      assert.equal(report.imported.movements, 12);
      assert.deepEqual(report.problems, []);
      assert.ok(steps.has('movements') && steps.has('categories'));

      for (const month of ['2025-08', '2025-09', '2025-10']) {
        const dash = await core.dashboard.get.execute(month);
        assert.deepEqual({ income: dash.monthIncome, expense: dash.monthExpense }, v1MonthTotals(v1.db, month), month);
      }
      // Fixos vêm com os lançamentos que a v1 gerou e NÃO são regerados
      const all = await core.movements.list.execute({ creditCardId: 'all_ungrouped', perPage: 1000 });
      assert.equal(all.total, 12);
    });
  }

  it('reaproveita as categorias padrão pelo nome e cria só as que faltam', async () => {
    const v1 = await createV1Database();
    seedV1(v1.db);
    const { core } = await familyWithDefaults();
    const before = (await core.categories.list.execute({ perPage: 1000 })).total;
    const report = await core.importV1.execute.execute(v1.adapter);
    assert.equal(report.existing.categories, 3); // Moradia, Alimentação, Salário
    assert.equal(report.imported.categories, 1); // Pets
    assert.equal((await core.categories.list.execute({ perPage: 1000 })).total, before + 1);
  });

  it('mapeia cartão, fixo, baixa e normaliza o tipo vazio do fixo para EXPENSE', async () => {
    const v1 = await createV1Database();
    seedV1(v1.db);
    const { core } = await familyWithDefaults();
    await core.importV1.execute.execute(v1.adapter);
    const card = (await core.creditCards.list.execute()).data.find((c) => c.description === 'Nubank')!;
    assert.equal(card.due_day, 8);
    const inv = await core.movements.list.execute({ creditCardId: card.id, startDate: '2025-08-01', endDate: '2025-08-31' });
    assert.equal(inv.total, 2);
    const fixed = await core.fixedExpenses.list.execute({ type: 'EXPENSE', yearMonth: '2025-08' });
    assert.equal(fixed.data[0].description, 'Aluguel');
    assert.equal(fixed.data[0].paid, true);
    assert.equal(fixed.data[0].member_id, ANA);
    assert.equal((await core.fixedExpenses.list.execute({ type: 'EXPENSE', yearMonth: '2025-10' })).data[0].paid, false);
    const rent = (await core.movements.list.execute({ search: 'Aluguel', creditCardId: 'all_ungrouped' })).data;
    assert.ok(rent.every((m) => m.member_id === ANA));
  });

  it('reimportar o mesmo arquivo não duplica; uma cópia mais nova traz só o que é novo', async () => {
    const v1 = await createV1Database();
    seedV1(v1.db);
    const { core } = await familyWithDefaults();
    await core.importV1.execute.execute(v1.adapter);
    const again = await core.importV1.execute.execute(v1.adapter);
    assert.equal(again.imported.movements, 0);
    assert.equal(again.existing.movements, 12);
    assert.equal(again.imported.fixed_expenses + again.imported.categories + again.imported.credit_cards, 0);

    // A pessoa continuou usando a v1 e importa o arquivo de novo
    v1.db.run("INSERT INTO movements (description, amount, date, type, category_id) VALUES ('Farmácia', 50, '2025-11-02', 'EXPENSE', 1)");
    const newer = await core.importV1.execute.execute(v1.adapter);
    assert.equal(newer.imported.movements, 1);
    assert.equal((await core.movements.list.execute({ creditCardId: 'all_ungrouped', perPage: 1000 })).total, 13);
  });

  it('o que a família excluiu depois de importar não volta', async () => {
    const v1 = await createV1Database();
    seedV1(v1.db);
    const { core } = await familyWithDefaults();
    await core.importV1.execute.execute(v1.adapter);
    const ration = (await core.movements.list.execute({ search: 'Ração', creditCardId: 'all_ungrouped' })).data;
    await core.movements.remove.execute(ration[0].id);
    const again = await core.importV1.execute.execute(v1.adapter);
    assert.equal(again.imported.movements, 0);
    assert.equal((await core.movements.list.execute({ search: 'Ração', creditCardId: 'all_ungrouped' })).total, 2);
  });

  it('FKs órfãs viram null e aparecem no relatório; linhas inválidas são ignoradas', async () => {
    const v1 = await createV1Database();
    seedV1(v1.db);
    v1.db.run("INSERT INTO movements (description, amount, date, type, category_id, credit_card_id, fixed_expense_id) VALUES ('Órfão', 10, '2025-10-01', 'EXPENSE', 99, 77, 55)");
    v1.db.run("INSERT INTO movements (description, amount, date, type, category_id) VALUES ('Zerado', 0, '2025-10-01', 'EXPENSE', 1)");
    v1.db.run("INSERT INTO fixed_expense_payments (fixed_expense_id, year_month) VALUES (42, '2025-09')");
    const { core } = await familyWithDefaults();
    const report = await core.importV1.execute.execute(v1.adapter);
    assert.equal(report.imported.movements, 13);
    const orphan = (await core.movements.list.execute({ search: 'Órfão', creditCardId: 'all_ungrouped' })).data[0];
    assert.deepEqual([orphan.category_id, orphan.credit_card_id], [null, null]);
    const reasons = report.problems.map((p) => `${p.table}:${p.oldId}`);
    assert.ok(reasons.includes('movements:13'), 'órfão reportado');
    assert.ok(reasons.includes('movements:14'), 'zerado ignorado');
    assert.ok(report.problems.some((p) => p.table === 'fixed_expense_payments'));
  });

  it('atribui o histórico ao membro escolhido; segundo banco na mesma família reaproveita cartões', async () => {
    const { core } = await familyWithDefaults();
    const ana = await createV1Database();
    seedV1(ana.db);
    await core.importV1.execute.execute(ana.adapter);

    // Banco da v1 do Beto (outro arquivo, mesmo nome de cartão)
    const beto = await createV1Database();
    beto.db.run("UPDATE users SET name = 'Beto', created_at = '2025-03-03 08:00:00'");
    beto.db.run("INSERT INTO credit_cards (description, color, due_day) VALUES ('nubank', '#000', 8)");
    beto.db.run("INSERT INTO movements (description, amount, date, type, category_id, credit_card_id) VALUES ('Tênis', 300, '2025-10-10', 'EXPENSE', 2, 1)");
    const report = await core.importV1.execute.execute(beto.adapter, { memberId: BETO });
    assert.equal(report.existing.credit_cards, 1);
    assert.equal(report.imported.movements, 1);
    assert.equal((await core.creditCards.list.execute()).total, 1);
    const dash = await core.dashboard.get.execute('2025-10', { memberId: BETO });
    assert.equal(dash.monthExpense, 300);
  });

  it('arquivo que não é da v1, membro sem permissão e membro de fora são recusados', async () => {
    const { core, session } = await familyWithDefaults();
    const other = await createV1Database();
    other.db.run('DROP TABLE movements');
    await assert.rejects(core.importV1.execute.execute(other.adapter), (e) => AppError.is(e, 'VALIDATION'));

    const v1 = await createV1Database();
    await assert.rejects(core.importV1.execute.execute(v1.adapter, { memberId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }), (e) => AppError.is(e, 'NOT_MEMBER'));
    session.set({ userId: BETO, familyId: FAMILY }); // Beto é MEMBER
    await assert.rejects(core.importV1.execute.execute(v1.adapter), (e) => AppError.is(e, 'FORBIDDEN'));
  });

  it('não altera o arquivo da v1', async () => {
    const v1 = await createV1Database();
    seedV1(v1.db);
    const before = Buffer.from(v1.db.export()).toString('base64');
    const { core } = await familyWithDefaults();
    await core.importV1.execute.execute(v1.adapter);
    assert.equal(Buffer.from(v1.db.export()).toString('base64'), before);
  });
});
