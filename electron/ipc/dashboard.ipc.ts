import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../src/interfaces/IElectronBridge.js';
import { getDatabase, queryObject, queryObjects } from '../database/index.js';
import { percentChange, resolveYearMonth } from '../services/date.service.js';

export function registerDashboardIpc() {
  ipcMain.handle(IPC_CHANNELS.DASHBOARD_GET_DATA, async (_event, targetYearMonth?: string) => {
    const empty = {
      totalBalance: 0, monthIncome: 0, monthExpense: 0, fixedExpensesTotal: 0,
      balanceTrend: 0, incomeTrend: 0, expenseTrend: 0,
      monthlyHistory: [], expensesByCategory: [], expensesByCard: [], upcomingFixedExpenses: [],
      fixedExpensesHistory: [],
    };
    const db = getDatabase();
    if (!db) return empty;

    const period = resolveYearMonth(targetYearMonth);
    const previous = resolveYearMonth(
      `${period.month === 1 ? period.year - 1 : period.year}-${String(period.month === 1 ? 12 : period.month - 1).padStart(2, '0')}`
    );

    const balanceSql = `SELECT SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END)
                             - SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS balance
                        FROM movements WHERE date <= ?`;
    const totalBalance = queryObject(balanceSql, [period.end])?.balance || 0;
    const previousBalance = queryObject(balanceSql, [previous.end])?.balance || 0;

    const summarySql = `SELECT SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS income,
                               SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS expense
                        FROM movements WHERE date >= ? AND date <= ?`;
    const current = queryObject(summarySql, [period.start, period.end]);
    const prev = queryObject(summarySql, [previous.start, previous.end]);

    const monthIncome = current?.income || 0;
    const monthExpense = current?.expense || 0;

    const fixedExpensesTotal = queryObject(
      `SELECT SUM(amount) AS total FROM fixed_expenses
       WHERE active = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)`,
      [period.end, period.start]
    )?.total || 0;

    // Histórico dos últimos 5 meses (o design mostra 5 colunas)
    const monthlyHistory: Array<{ month: string; income: number; expense: number }> = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(period.year, period.month - 1 - i, 1);
      const p = resolveYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const row = queryObject(summarySql, [p.start, p.end]);
      monthlyHistory.push({
        month: label.charAt(0).toUpperCase() + label.slice(1),
        income: row?.income || 0,
        expense: row?.expense || 0,
      });
    }

    const expensesByCategory = queryObjects(
      `SELECT c.id, c.name AS label, c.color, SUM(m.amount) AS value
       FROM movements m JOIN categories c ON m.category_id = c.id
       WHERE m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?
       GROUP BY c.id, c.name, c.color ORDER BY value DESC`,
      [period.start, period.end]
    ).map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#94a3b8' }));

    const expensesByCard = queryObjects(
      `SELECT cc.id, cc.description AS label, cc.color, SUM(m.amount) AS value
       FROM movements m JOIN credit_cards cc ON m.credit_card_id = cc.id
       WHERE m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?
       GROUP BY cc.id, cc.description, cc.color ORDER BY value DESC`,
      [period.start, period.end]
    ).map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#8b5cf6' }));

    const upcomingFixedExpenses = queryObjects(
      `SELECT f.*, c.name AS category_name, c.color AS category_color,
              CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS paid
       FROM fixed_expenses f
       LEFT JOIN categories c ON f.category_id = c.id
       LEFT JOIN fixed_expense_payments p ON p.fixed_expense_id = f.id AND p.year_month = ?
       WHERE f.active = 1 AND f.start_date <= ? AND (f.end_date IS NULL OR f.end_date >= ?)
       ORDER BY f.due_day ASC`,
      [period.yearMonth, period.end, period.start]
    ).map((f) => {
      const day = Math.min(f.due_day, period.lastDay);
      return {
        ...f,
        formattedDueDate: `${String(day).padStart(2, '0')}/${String(period.month).padStart(2, '0')}/${period.year}`,
      };
    });

    // Projeção/Histórico de 12 meses de despesas fixas: 1 mês anterior (-1), mês atual (0) e próximos 10 meses (+1 a +10)
    const fixedExpensesHistory: Array<{ month: string; yearMonth: string; value: number }> = [];
    for (let offset = -1; offset <= 10; offset++) {
      const d = new Date(period.year, period.month - 1 + offset, 1);
      const p = resolveYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      const rawLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

      const row = queryObject(
        `SELECT SUM(amount) AS total FROM fixed_expenses
         WHERE active = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)`,
        [p.end, p.start]
      );

      fixedExpensesHistory.push({
        month: monthLabel,
        yearMonth: p.yearMonth,
        value: row?.total || 0,
      });
    }

    return {
      totalBalance,
      monthIncome,
      monthExpense,
      fixedExpensesTotal,
      balanceTrend: percentChange(totalBalance, previousBalance),
      incomeTrend: percentChange(monthIncome, prev?.income || 0),
      expenseTrend: percentChange(monthExpense, prev?.expense || 0),
      monthlyHistory,
      expensesByCategory,
      expensesByCard,
      upcomingFixedExpenses,
      fixedExpensesHistory,
    };
  });
}
