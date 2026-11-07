import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError, LOCAL_SCHEMA_VERSION, migrateLocalDatabase } from '../src/index';
import { ANA, BETO, CAIO, FAMILY, OTHER_FAMILY, outbox, setupCore } from './helpers';

const expense = (extra: Record<string, unknown> = {}) => ({
  description: 'Mercado',
  amount: 100,
  date: '2026-10-03',
  type: 'EXPENSE' as const,
  ...extra,
});

describe('schema local', () => {
  it('migra até a versão atual e é idempotente', async () => {
    const { db } = await setupCore();
    assert.equal(await migrateLocalDatabase(db), LOCAL_SCHEMA_VERSION);
    const row = await db.first<{ user_version: number }>('PRAGMA user_version');
    assert.equal(row?.user_version, LOCAL_SCHEMA_VERSION);
  });

  it('recusa banco local de versão mais nova do app', async () => {
    const { db } = await setupCore();
    await db.exec(`PRAGMA user_version = ${LOCAL_SCHEMA_VERSION + 1}`);
    await assert.rejects(migrateLocalDatabase(db), /versão mais nova/);
  });
});

describe('categorias', () => {
  it('cria as 18 categorias padrão uma vez só', async () => {
    const { core } = await setupCore();
    assert.equal(await core.categories.seedDefaults.execute(), 18);
    assert.equal(await core.categories.seedDefaults.execute(), 0);
    assert.equal((await core.categories.list.execute()).total, 18);
  });

  it('pagina, ordena e calcula o consumido do mês', async () => {
    const { core } = await setupCore();
    await core.categories.seedDefaults.execute();
    const moradia = (await core.categories.list.execute({ search: 'Moradia' })).data[0];
    await core.movements.create.execute(expense({ category_id: moradia.id, date: '2026-10-05', amount: 1500 }));
    const page = await core.categories.list.execute({ yearMonth: '2026-10', type: 'EXPENSE', perPage: 5, page: 0, orderField: 'consumed', orderDirection: 'desc' });
    assert.equal(page.total, 14);
    assert.equal(page.data.length, 5);
    assert.equal(page.data[0].name, 'Moradia');
    assert.equal(page.data[0].consumed, 1500);
  });

  it('recusa nome repetido do mesmo tipo, mas permite reaproveitar o de uma excluída', async () => {
    const { core } = await setupCore();
    const id = await core.categories.create.execute({ name: 'Pet', type: 'EXPENSE' });
    await assert.rejects(core.categories.create.execute({ name: 'pet', type: 'EXPENSE' }), (e) => AppError.is(e, 'CONFLICT'));
    await core.categories.create.execute({ name: 'Pet', type: 'INCOME' });
    await core.categories.remove.execute(id);
    await core.categories.create.execute({ name: 'Pet', type: 'EXPENSE' });
  });

  it('excluir categoria tira a categoria dos lançamentos e manda tudo para o outbox', async () => {
    const { core, db } = await setupCore();
    const cat = await core.categories.create.execute({ name: 'Pet', type: 'EXPENSE' });
    const mov = await core.movements.create.execute(expense({ category_id: cat }));
    await db.run('DELETE FROM _outbox');
    await core.categories.remove.execute(cat);
    assert.equal((await core.movements.get.execute(mov)).category_id, null);
    const pending = await outbox(db);
    assert.deepEqual(pending.map((p) => p.table_name).sort(), ['categories', 'movements']);
    await assert.rejects(core.categories.get.execute(cat), (e) => AppError.is(e, 'NOT_FOUND'));
  });
});

describe('outbox e exclusão lógica', () => {
  it('toda escrita entra no outbox na mesma transação, compactada por linha', async () => {
    const { core, db } = await setupCore();
    const id = await core.movements.create.execute(expense());
    await core.movements.update.execute(id, expense({ amount: 120 }));
    await core.movements.update.execute(id, expense({ amount: 130 }));
    const pending = (await outbox(db)).filter((p) => p.table_name === 'movements');
    assert.equal(pending.length, 1);
    assert.equal(pending[0].row_id, id);
  });

  it('base_xid guarda a versão do servidor em que a edição se baseou', async () => {
    const { core, db } = await setupCore();
    const id = await core.movements.create.execute(expense());
    await db.run('DELETE FROM _outbox');
    await db.run("UPDATE movements SET change_xid = '987' WHERE id = ?", [id]); // simula pull
    await core.movements.update.execute(id, expense({ amount: 200 }));
    assert.equal((await outbox(db))[0].base_xid, '987');
  });

  it('erro no meio desfaz a escrita e não deixa nada no outbox', async () => {
    const { core, db } = await setupCore();
    await assert.rejects(
      core.store.write(async (ctx) => {
        await core.repos.categories.create(ctx, { name: 'X', type: 'EXPENSE', color: '#000', icon: 'Tag', description: null, monthly_limit: null });
        throw new Error('falhou');
      }),
    );
    assert.equal((await outbox(db)).length, 0);
    assert.equal((await core.categories.list.execute()).total, 0);
  });

  it('excluir é lógico: some das consultas, fica no banco com deleted_at', async () => {
    const { core, db } = await setupCore();
    const id = await core.movements.create.execute(expense());
    await core.movements.remove.execute(id);
    assert.equal((await core.movements.list.execute()).total, 0);
    const row = await db.first('SELECT deleted_at FROM movements WHERE id = ?', [id]);
    assert.ok(row.deleted_at);
  });

  it('avisa os ouvintes com as tabelas alteradas', async () => {
    const { core } = await setupCore();
    const seen: string[][] = [];
    core.store.onChange((tables) => seen.push(tables));
    await core.movements.create.execute(expense());
    assert.deepEqual(seen, [['movements']]);
  });
});

describe('família', () => {
  it('não enxerga dados de outra família', async () => {
    const { core, session } = await setupCore();
    await core.movements.create.execute(expense());
    session.set({ userId: CAIO, familyId: OTHER_FAMILY });
    assert.equal((await core.movements.list.execute()).total, 0);
    await core.movements.create.execute(expense({ description: 'Do Caio' }));
    session.set({ userId: ANA, familyId: FAMILY });
    const list = await core.movements.list.execute();
    assert.deepEqual(list.data.map((m) => m.description), ['Mercado']);
  });

  it('lançamento fica no nome de quem está logado, ou do membro escolhido', async () => {
    const { core } = await setupCore();
    const mine = await core.movements.create.execute(expense());
    const beto = await core.movements.create.execute(expense({ member_id: BETO }));
    assert.equal((await core.movements.get.execute(mine)).member_name, 'Ana');
    const m = await core.movements.get.execute(beto);
    assert.equal(m.member_name, 'Beto');
    assert.equal(m.created_by, ANA, 'created_by é quem digitou');
  });

  it('recusa lançamento em nome de quem não é da família', async () => {
    const { core } = await setupCore();
    await assert.rejects(core.movements.create.execute(expense({ member_id: CAIO })), (e) => AppError.is(e, 'NOT_MEMBER'));
  });

  it('recusa categoria de outra família', async () => {
    const { core, session } = await setupCore();
    session.set({ userId: CAIO, familyId: OTHER_FAMILY });
    const other = await core.categories.create.execute({ name: 'Alheia', type: 'EXPENSE' });
    session.set({ userId: ANA, familyId: FAMILY });
    await assert.rejects(core.movements.create.execute(expense({ category_id: other })), (e) => AppError.is(e, 'VALIDATION'));
  });

  it('sem sessão, nada funciona', async () => {
    const { core, session } = await setupCore();
    session.clear();
    await assert.rejects(core.movements.list.execute(), (e) => AppError.is(e, 'NOT_AUTHENTICATED'));
    session.set({ userId: ANA });
    await assert.rejects(core.movements.list.execute(), (e) => AppError.is(e, 'NO_FAMILY'));
  });
});

describe('transferências', () => {
  it('valida destinatário e ignora categoria e cartão', async () => {
    const { core } = await setupCore();
    const cat = await core.categories.create.execute({ name: 'Pet', type: 'EXPENSE' });
    const t = (extra: Record<string, unknown>) => ({ description: 'Mesada', amount: 50, date: '2026-10-10', type: 'TRANSFER' as const, ...extra });
    await assert.rejects(core.movements.create.execute(t({})), (e) => AppError.is(e, 'VALIDATION'));
    await assert.rejects(core.movements.create.execute(t({ to_member_id: ANA })), (e) => AppError.is(e, 'VALIDATION'));
    await assert.rejects(core.movements.create.execute(t({ to_member_id: CAIO })), (e) => AppError.is(e, 'NOT_MEMBER'));
    const id = await core.movements.create.execute(t({ to_member_id: BETO, category_id: cat }));
    const m = await core.movements.get.execute(id);
    assert.equal(m.category_id, null);
    assert.equal(m.to_member_name, 'Beto');
  });

  it('não contam como receita nem despesa no resumo e no dashboard', async () => {
    const { core } = await setupCore();
    await core.movements.create.execute(expense({ date: '2026-10-03' }));
    await core.movements.create.execute({ description: 'Mesada', amount: 50, date: '2026-10-10', type: 'TRANSFER', to_member_id: BETO });
    const list = await core.movements.list.execute({ startDate: '2026-10-01', endDate: '2026-10-31' });
    assert.equal(list.total, 2);
    assert.equal(list.summary.totalExpense, 100);
    assert.equal(list.summary.totalIncome, 0);
    const dash = await core.dashboard.get.execute('2026-10');
    assert.equal(dash.monthExpense, 100);
    assert.equal(dash.totalBalance, -100);
  });

  it('filtro por membro traz o que ele envia e recebe', async () => {
    const { core } = await setupCore();
    await core.movements.create.execute(expense());
    await core.movements.create.execute({ description: 'Mesada', amount: 50, date: '2026-10-10', type: 'TRANSFER', to_member_id: BETO });
    const beto = await core.movements.list.execute({ memberId: BETO });
    assert.deepEqual(beto.data.map((m) => m.description), ['Mesada']);
  });
});

describe('lançamentos e faturas (regras da v1)', () => {
  it('agrupa por cartão + mês, com id único e vencimento do cartão', async () => {
    const { core } = await setupCore();
    const inter = await core.creditCards.create.execute({ description: 'Inter', color: '#f97316', due_day: 10 });
    const nubank = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    await core.movements.create.execute(expense({ credit_card_id: inter }));
    await core.movements.create.execute({ description: 'Estorno', amount: 20, date: '2026-10-05', type: 'INCOME', credit_card_id: inter });
    await core.movements.create.execute(expense({ description: 'Farmácia', amount: 50, date: '2026-11-02', credit_card_id: inter }));
    await core.movements.create.execute(expense({ description: 'Streaming', amount: 40, date: '2026-10-20', credit_card_id: nubank }));
    await core.movements.create.execute(expense({ description: 'Aluguel', amount: 1500, date: '2026-10-10' }));

    const list = await core.movements.list.execute({ startDate: '2026-10-01', endDate: '2026-11-30' });
    const invoices = list.data.filter((m) => m.isGroupedCard);
    assert.equal(invoices.length, 3);
    assert.equal(new Set(invoices.map((i) => i.id)).size, 3);
    const interOct = invoices.find((i) => i.groupKey === `${inter}_2026-10`)!;
    assert.equal(interOct.amount, 80);
    assert.equal(interOct.date, '2026-10-10');
    assert.equal(list.summary.totalExpense, 1690);
    assert.equal(list.summary.totalIncome, 20);

    const detailed = await core.movements.list.execute({ startDate: '2026-10-01', endDate: '2026-10-31', creditCardId: inter });
    assert.equal(detailed.total, 2);
    assert.ok(!detailed.data[0].isGroupedCard);

    const paged = await core.movements.list.execute({ startDate: '2026-10-01', endDate: '2026-11-30', perPage: 2, page: 1 });
    assert.equal(paged.total, 4);
    assert.equal(paged.data.length, 2);
  });

  it('exclusão em lote por cartão + mês', async () => {
    const { core } = await setupCore();
    const inter = await core.creditCards.create.execute({ description: 'Inter', due_day: 10 });
    await core.movements.create.execute(expense({ credit_card_id: inter }));
    await core.movements.create.execute({ description: 'Estorno', amount: 20, date: '2026-10-05', type: 'INCOME', credit_card_id: inter });
    await core.movements.create.execute(expense({ date: '2026-11-02', credit_card_id: inter }));
    const preview = await core.movements.previewBulkDeleteCard.execute(inter, '2026-10');
    const { members, ...totals } = preview;
    assert.deepEqual(totals, { count: 2, totalExpense: 100, totalIncome: 20, fixedCount: 0 });
    assert.equal(members.length, 1);
    assert.equal(members[0].count, 2);
    assert.equal(await core.movements.bulkDeleteCard.execute(inter, '2026-10'), 2);
    assert.equal((await core.movements.list.execute({ creditCardId: 'all_ungrouped' })).total, 1);
    await assert.rejects(core.movements.bulkDeleteCard.execute(inter, '2026-13'), (e) => AppError.is(e, 'VALIDATION'));
  });

  it('excluir cartão mantém os lançamentos, sem cartão', async () => {
    const { core } = await setupCore();
    const card = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    const id = await core.movements.create.execute(expense({ credit_card_id: card }));
    await core.creditCards.remove.execute(card);
    assert.equal((await core.movements.get.execute(id)).credit_card_id, null);
    assert.equal((await core.creditCards.list.execute()).total, 0);
  });

  it('arredonda valores a centavos e valida campos', async () => {
    const { core } = await setupCore();
    const id = await core.movements.create.execute(expense({ amount: 10.005 }));
    assert.equal((await core.movements.get.execute(id)).amount, 10.01);
    await assert.rejects(core.movements.create.execute(expense({ amount: 0 })), (e) => AppError.is(e, 'VALIDATION'));
    await assert.rejects(core.movements.create.execute(expense({ date: '03/10/2026' })), (e) => AppError.is(e, 'VALIDATION'));
    await assert.rejects(core.movements.create.execute(expense({ description: '  ' })), (e) => AppError.is(e, 'VALIDATION'));
  });
});

describe('lançamentos fixos', () => {
  it('gera, regera e exclui os lançamentos automáticos', async () => {
    const { core, db } = await setupCore();
    const card = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    const base = { description: 'Internet', amount: 125, type: 'EXPENSE' as const, credit_card_id: card, due_day: 31, start_date: '2026-10-01', end_date: '2027-01-31' };
    const id = await core.fixedExpenses.create.execute(base);
    const dates = async () =>
      (await db.all('SELECT date, amount FROM movements WHERE fixed_expense_id = ? AND deleted_at IS NULL ORDER BY date', [id])).map((r) => `${r.date}:${r.amount}`);
    assert.deepEqual(await dates(), ['2026-10-31:125', '2026-11-30:125', '2026-12-31:125', '2027-01-31:125']);

    await core.fixedExpenses.update.execute(id, { ...base, amount: 130, recurrence: 'BIMONTHLY', due_day: 15 });
    assert.deepEqual(await dates(), ['2026-10-15:130', '2026-12-15:130']);

    await core.fixedExpenses.remove.execute(id);
    assert.deepEqual(await dates(), []);
    assert.equal((await core.fixedExpenses.list.execute()).total, 0);
  });

  it('receita fixa não aceita cartão', async () => {
    const { core } = await setupCore();
    const card = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    const id = await core.fixedExpenses.create.execute({ description: 'Salário', amount: 5000, type: 'INCOME', credit_card_id: card, due_day: 5, start_date: '2026-10-01' });
    assert.equal((await core.fixedExpenses.get.execute(id)).credit_card_id, null);
  });

  it('baixa do mês: marcar, desfazer e refazer reaproveita a mesma linha', async () => {
    const { core, db } = await setupCore();
    const id = await core.fixedExpenses.create.execute({ description: 'Luz', amount: 200, due_day: 10, start_date: '2026-01-01' });
    await core.fixedExpenses.setPaid.execute(id, '2026-10', true);
    assert.equal((await core.fixedExpenses.list.execute({ yearMonth: '2026-10' })).data[0].paid, true);
    await core.fixedExpenses.setPaid.execute(id, '2026-10', false);
    assert.equal((await core.fixedExpenses.list.execute({ yearMonth: '2026-10' })).data[0].paid, false);
    await core.fixedExpenses.setPaid.execute(id, '2026-10', true);
    const rows = await db.all('SELECT id FROM fixed_expense_payments');
    assert.equal(rows.length, 1);
    assert.equal((await core.fixedExpenses.list.execute({ yearMonth: '2026-11' })).data[0].paid, false);
  });

  it('dashboard soma fixos ativos e mostra histórico de 5 meses', async () => {
    const { core } = await setupCore();
    const card = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    await core.movements.create.execute(expense({ description: 'Aluguel', amount: 1500, date: '2026-10-10' }));
    await core.movements.create.execute(expense({ description: 'Streaming', amount: 40, date: '2026-10-20', credit_card_id: card }));
    await core.fixedExpenses.create.execute({ description: 'Internet', amount: 130, credit_card_id: card, recurrence: 'BIMONTHLY', due_day: 15, start_date: '2026-10-01', end_date: '2027-01-31' });
    const dash = await core.dashboard.get.execute('2026-10');
    assert.equal(dash.monthExpense, 1670);
    assert.equal(dash.fixedExpensesTotal, 130);
    assert.equal(dash.monthlyHistory.length, 5);
    assert.equal(dash.monthlyHistory[4].month, 'Out');
    assert.ok(dash.expensesByCard.some((c) => c.label === 'Nubank'));
    assert.equal(dash.upcomingFixedExpenses[0].formattedDueDate, '15/10/2026');
  });
});

describe('importação de fatura', () => {
  const csv = 'date,title,amount\n2026-10-01,Padaria Central,12.50\n2026-10-03,Posto Shell,150.00\n2026-10-05,Pagamento recebido,-500.00\n';

  it('lê o CSV, aplica o vencimento e grava com nota da data original', async () => {
    const { core } = await setupCore();
    const card = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    const analysis = await core.movements.analyzeImport.execute(csv, { fileName: 'Nubank_2026-11-08.csv', creditCardId: card });
    assert.equal(analysis.items.length, 3);
    assert.equal(analysis.invoicePaymentCount, 1);
    assert.equal(analysis.invoiceDate, '2026-10-08');
    const result = await core.movements.executeImport.execute(analysis.items, card);
    assert.deepEqual(result, { imported: 2, skipped: 0 });
    const padaria = (await core.movements.list.execute({ search: 'Padaria', creditCardId: card })).data[0];
    assert.equal(padaria.date, '2026-10-08');
    assert.match(padaria.notes!, /^Compra realizada em 01\/10\/2026/);
    assert.ok(padaria.import_hash?.startsWith('csv:nubank:'));
  });

  it('reimportar o mesmo arquivo não duplica (import_hash)', async () => {
    const { core } = await setupCore();
    const card = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    const first = await core.movements.analyzeImport.execute(csv, { creditCardId: card });
    await core.movements.executeImport.execute(first.items, card);
    const again = await core.movements.analyzeImport.execute(csv, { creditCardId: card });
    assert.equal(again.alreadyImportedCount, 2);
    assert.ok(again.items.filter((i) => !i.isInvoicePayment).every((i) => !i.selected));
    // Mesmo forçando a seleção, nada é gravado em dobro
    const forced = again.items.map((i) => ({ ...i, selected: true }));
    assert.deepEqual(await core.movements.executeImport.execute(forced, card), { imported: 1, skipped: 2 });
  });

  it('duas compras iguais no mesmo dia viram dois lançamentos', async () => {
    const { core } = await setupCore();
    const twice = 'date,title,amount\n2026-10-01,Cafe,5.00\n2026-10-01,Cafe,5.00\n';
    const analysis = await core.movements.analyzeImport.execute(twice, {});
    assert.notEqual(analysis.items[0].importHash, analysis.items[1].importHash);
    const all = analysis.items.map((i) => ({ ...i, selected: true }));
    assert.equal((await core.movements.executeImport.execute(all, null)).imported, 2);
  });
});

describe('totalização da família (Etapa 7)', () => {
  /** Ana e Beto lançando em outubro, com mesada de Ana para Beto e um fixo de cada. */
  async function familyScenario(withTransfer = true) {
    const { core } = await setupCore();
    const card = await core.creditCards.create.execute({ description: 'Nubank', due_day: 8 });
    await core.movements.create.execute({ description: 'Salário Ana', amount: 5000, date: '2026-10-05', type: 'INCOME' });
    await core.movements.create.execute({ description: 'Salário Beto', amount: 3000, date: '2026-10-05', type: 'INCOME', member_id: BETO });
    await core.movements.create.execute(expense({ description: 'Mercado', amount: 800, date: '2026-10-08' }));
    await core.movements.create.execute(expense({ description: 'Tênis', amount: 400, date: '2026-10-12', member_id: BETO, credit_card_id: card }));
    await core.movements.create.execute(expense({ description: 'Setembro', amount: 100, date: '2026-09-20', member_id: BETO }));
    if (withTransfer) {
      await core.movements.create.execute({ description: 'Mesada', amount: 200, date: '2026-10-10', type: 'TRANSFER', to_member_id: BETO });
    }
    await core.fixedExpenses.create.execute({ description: 'Aluguel', amount: 1500, member_id: ANA, due_day: 5, start_date: '2026-10-01', end_date: '2027-12-31' });
    await core.fixedExpenses.create.execute({ description: 'Academia', amount: 100, member_id: BETO, due_day: 10, start_date: '2026-10-01', end_date: '2027-12-31' });
    return { core };
  }

  it('visão família = soma das visões individuais', async () => {
    const { core } = await familyScenario();
    const fam = await core.dashboard.get.execute('2026-10');
    const ana = await core.dashboard.get.execute('2026-10', { memberId: ANA });
    const beto = await core.dashboard.get.execute('2026-10', { memberId: BETO });

    assert.deepEqual(fam.view, { memberId: null, memberName: null });
    assert.deepEqual(beto.view, { memberId: BETO, memberName: 'Beto' });
    assert.equal(fam.monthIncome, ana.monthIncome + beto.monthIncome);
    assert.equal(fam.monthExpense, ana.monthExpense + beto.monthExpense);
    assert.equal(fam.totalBalance, ana.totalBalance + beto.totalBalance);
    assert.equal(fam.fixedExpensesTotal, ana.fixedExpensesTotal + beto.fixedExpensesTotal);
    for (let i = 0; i < fam.monthlyHistory.length; i++) {
      assert.equal(fam.monthlyHistory[i].expense, ana.monthlyHistory[i].expense + beto.monthlyHistory[i].expense);
    }
    // Números conferidos à mão (os fixos geram os lançamentos do mês: 1500 da Ana, 100 do Beto)
    assert.equal(fam.monthIncome, 8000);
    assert.equal(fam.monthExpense, 800 + 400 + 1500 + 100);
    assert.equal(beto.monthExpense, 400 + 100);
    assert.equal(fam.totalBalance, 8000 - 2800 - 100);
  });

  it('transferência não muda os totais da família e entra no saldo de quem envia/recebe', async () => {
    const withT = await familyScenario(true);
    const without = await familyScenario(false);
    const a = await withT.core.dashboard.get.execute('2026-10');
    const b = await without.core.dashboard.get.execute('2026-10');
    assert.equal(a.totalBalance, b.totalBalance);
    assert.equal(a.monthIncome, b.monthIncome);
    assert.equal(a.monthExpense, b.monthExpense);
    assert.equal(a.transferIn + a.transferOut, 0);

    const ana = await withT.core.dashboard.get.execute('2026-10', { memberId: ANA });
    const beto = await withT.core.dashboard.get.execute('2026-10', { memberId: BETO });
    const anaSem = await without.core.dashboard.get.execute('2026-10', { memberId: ANA });
    assert.equal(ana.transferOut, 200);
    assert.equal(beto.transferIn, 200);
    assert.equal(ana.totalBalance, anaSem.totalBalance - 200);
    assert.equal(ana.monthExpense, anaSem.monthExpense, 'mesada não é despesa');
    assert.ok(!beto.expensesByCategory.some((c) => c.value === 200));
  });

  it('gráficos e listas respeitam a visão; byMember é sempre da família', async () => {
    const { core } = await familyScenario();
    const fam = await core.dashboard.get.execute('2026-10');
    const ana = await core.dashboard.get.execute('2026-10', { memberId: ANA });
    assert.deepEqual(
      fam.byMember.map((m) => [m.name, m.income, m.expense]).sort(),
      [
        ['Ana', 5000, 2300],
        ['Beto', 3000, 500],
      ],
    );
    assert.deepEqual(ana.byMember, fam.byMember);
    assert.equal(ana.expensesByCard.length, 0, 'o cartão só foi usado pelo Beto');
    assert.deepEqual(ana.upcomingFixedExpenses.map((f) => [f.description, f.member_name]), [['Aluguel', 'Ana']]);
    assert.equal(fam.upcomingFixedExpenses.length, 2);
  });

  it('membro de outra família é recusado', async () => {
    const { core } = await familyScenario();
    await assert.rejects(core.dashboard.get.execute('2026-10', { memberId: CAIO }), (e) => AppError.is(e, 'NOT_MEMBER'));
  });

  it('limite de categoria considera o consumo da família inteira', async () => {
    const { core } = await setupCore();
    const cat = await core.categories.create.execute({ name: 'Lazer', type: 'EXPENSE', monthly_limit: 500 });
    await core.movements.create.execute(expense({ category_id: cat, amount: 300 }));
    await core.movements.create.execute(expense({ category_id: cat, amount: 150, member_id: BETO }));
    const list = await core.categories.list.execute({ yearMonth: '2026-10', perPage: 100 });
    assert.equal(list.data.find((c) => c.id === cat)?.consumed, 450);
  });
});
