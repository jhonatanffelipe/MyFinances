/// <reference types="node" />
/**
 * Testes da camada de dados do mobile (rodam no Node com sql.js):
 *   npm run test:data
 */
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import { setDatabase, getDb, onDataChanged } from '../src/data/db';
import { createTablesAndRunMigrations } from '../src/data/schema';
import { seedInitialCategories } from '../src/data/seed';
import * as movements from '../src/data/repositories/movements';
import * as cards from '../src/data/repositories/creditCards';
import * as categories from '../src/data/repositories/categories';
import * as fixed from '../src/data/repositories/fixedEntries';
import * as dashboard from '../src/data/repositories/dashboard';
import * as auth from '../src/data/repositories/auth';
import * as importer from '../src/data/repositories/importer';
import { createSqlJsAdapter } from './sqljsAdapter';

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

async function main() {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  setDatabase(createSqlJsAdapter(raw));
  let changes = 0;
  onDataChanged(() => changes++);

  await createTablesAndRunMigrations(getDb());
  await seedInitialCategories(getDb());
  await createTablesAndRunMigrations(getDb()); // idempotente
  const cats = await categories.listCategories({ yearMonth: '2026-10' });
  ok(cats.length === 18, 'schema + seed com 18 categorias');
  const moradia = cats.find((c) => c.name === 'Moradia')!;

  // Cartões e movimentos
  const inter = await cards.createCreditCard({ description: 'Inter', color: '#f97316', due_day: 10 });
  const nubank = await cards.createCreditCard({ description: 'Nubank', color: '#8b5cf6', due_day: 8 });
  await movements.createMovement({ description: 'Mercado', amount: 100, date: '2026-10-03', type: 'EXPENSE', category_id: moradia.id, credit_card_id: inter });
  await movements.createMovement({ description: 'Estorno', amount: 20, date: '2026-10-05', type: 'INCOME', category_id: moradia.id, credit_card_id: inter });
  await movements.createMovement({ description: 'Farmácia', amount: 50, date: '2026-11-02', type: 'EXPENSE', category_id: moradia.id, credit_card_id: inter });
  await movements.createMovement({ description: 'Streaming', amount: 40, date: '2026-10-20', type: 'EXPENSE', category_id: moradia.id, credit_card_id: nubank });
  await movements.createMovement({ description: 'Aluguel', amount: 1500, date: '2026-10-10', type: 'EXPENSE', category_id: moradia.id });
  ok(changes === 7, 'cada escrita notifica a sincronização');

  const list = await movements.listMovements({ startDate: '2026-10-01', endDate: '2026-11-30' });
  const invoices = list.data.filter((m) => m.isGroupedCard);
  ok(invoices.length === 3, 'agrupa faturas por cartão + mês (Inter out, Inter nov, Nubank out)');
  ok(new Set(invoices.map((i) => i.id)).size === 3, 'ids das faturas são únicos');
  const interOut = invoices.find((i) => i.groupKey === `${inter}_2026-10`)!;
  ok(interOut.amount === 80 && interOut.date === '2026-10-10', 'fatura Inter out = 100 - 20, vencimento dia 10');
  ok(list.summary.totalExpense === 1690 && list.summary.totalIncome === 20, 'resumo do período');

  const detailed = await movements.listMovements({ startDate: '2026-10-01', endDate: '2026-10-31', creditCardId: inter });
  ok(detailed.data.length === 2 && !detailed.data[0].isGroupedCard, 'filtro por cartão lista itens detalhados');

  // Exclusão em lote
  const preview = await movements.previewBulkDeleteCard(inter, '2026-10');
  ok(preview.count === 2 && preview.totalExpense === 100 && preview.totalIncome === 20, 'prévia da exclusão em lote');
  ok((await movements.bulkDeleteCard(inter, '2026-10')) === 2, 'exclusão em lote remove só cartão + mês');
  ok((await getDb().first<any>('SELECT COUNT(*) c FROM movements')).c === 3, 'demais lançamentos preservados');

  // Lançamentos fixos
  const fixedId = await fixed.createFixedEntry({
    description: 'Internet', amount: 125, type: 'EXPENSE', category_id: moradia.id, credit_card_id: nubank,
    recurrence: 'MONTHLY', due_day: 31, start_date: '2026-10-01', end_date: '2027-01-31',
  });
  const gen = await getDb().all<any>('SELECT date FROM movements WHERE fixed_expense_id = ? ORDER BY date', [fixedId]);
  ok(gen.map((g) => g.date).join(',') === '2026-10-31,2026-11-30,2026-12-31,2027-01-31', 'gera movimentos mensais respeitando fim do mês');
  await fixed.updateFixedEntry(fixedId, {
    description: 'Internet', amount: 130, type: 'EXPENSE', category_id: moradia.id, credit_card_id: nubank,
    recurrence: 'BIMONTHLY', due_day: 15, start_date: '2026-10-01', end_date: '2027-01-31',
  });
  const regen = await getDb().all<any>('SELECT date, amount FROM movements WHERE fixed_expense_id = ? ORDER BY date', [fixedId]);
  ok(regen.length === 2 && regen[0].date === '2026-10-15' && regen[0].amount === 130, 'edição regera movimentos (bimestral)');
  await fixed.setFixedEntryPaid(fixedId, '2026-10', true);
  const listFixed = await fixed.listFixedEntries('EXPENSE', '2026-10');
  ok(listFixed.length === 1 && listFixed[0].paid === 1, 'baixa do mês registrada');
  await fixed.setFixedEntryPaid(fixedId, '2026-10', false);
  ok((await fixed.listFixedEntries('EXPENSE', '2026-10'))[0].paid === 0, 'baixa desfeita');

  // Dashboard
  const dash = await dashboard.getDashboardData('2026-10');
  ok(dash.monthExpense === 1500 + 40 + 130 && dash.fixedExpensesTotal === 130, 'dashboard: despesas e fixos do mês');
  ok(dash.monthlyHistory.length === 5 && dash.monthlyHistory[4].month === 'Out', 'dashboard: histórico de 5 meses');
  ok(dash.expensesByCard.some((c) => c.label === 'Nubank'), 'dashboard: despesas por cartão');

  // Excluir cartão mantém lançamentos
  await cards.deleteCreditCard(nubank);
  ok((await getDb().first<any>('SELECT COUNT(*) c FROM movements WHERE description = ?', ['Streaming'])).c === 1, 'excluir cartão mantém lançamentos');

  // Senha criada no desktop (scrypt do Node) funciona no mobile e vice-versa
  const salt = crypto.randomBytes(16).toString('hex');
  const desktopHash = `${salt}:${crypto.scryptSync('minhaSenha123', salt, 64).toString('hex')}`;
  await getDb().run('INSERT INTO users (name, password_hash) VALUES (?, ?)', ['Jhonatan', desktopHash]);
  ok((await auth.login('Jhonatan', 'minhaSenha123')).success, 'login com senha criada no desktop');
  ok(!(await auth.login('Jhonatan', 'errada')).success, 'senha errada recusada');
  const mobileHash = await auth.hashPassword('outraSenha');
  const [mSalt, mKey] = mobileHash.split(':');
  ok(crypto.scryptSync('outraSenha', mSalt, 64).toString('hex') === mKey, 'senha criada no mobile é válida no desktop');

  // Importação de fatura Nubank
  const csv = 'date,title,amount\n2026-10-01,Padaria Central,12.50\n2026-10-03,Posto Shell,150.00\n2026-10-05,Pagamento recebido,-500.00\n';
  const card = await cards.createCreditCard({ description: 'Nubank 2', due_day: 8 });
  const analysis = await importer.analyzeImport(csv, { fileName: 'Nubank_2026-11-08.csv', creditCardId: card });
  ok(analysis.items.length === 3 && analysis.invoicePaymentCount === 1, `importação lê ${analysis.items.length} itens e detecta pagamento de fatura`);
  ok(analysis.invoiceDate === '2026-10-08', `data de vencimento aplicada: ${analysis.invoiceDate}`);
  const imported = await importer.executeImport(analysis.items, card);
  const note = await getDb().first<any>("SELECT notes, date FROM movements WHERE description = 'Padaria Central'");
  ok(imported === 2 && note.date === '2026-10-08' && note.notes.startsWith('Compra realizada em 01/10/2026'), 'importa selecionados com nota da data original');
  // Lançamentos sem cartão mantêm a data original e são reconhecidos como duplicados
  const csv2 = 'date,title,amount\n2026-10-12,Livraria Cultura,80.00\n';
  await importer.executeImport((await importer.analyzeImport(csv2, {})).items, null);
  ok((await importer.analyzeImport(csv2, {})).duplicateCount === 1, 'reimportação marca duplicidade');

  console.log(failures ? `\n${failures} falha(s)` : '\nTodos os testes passaram');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
