import { getDb } from '../db';
import { monthShortLabel, percentChange, resolveYearMonth, shiftYearMonth } from '../date';
import { DashboardData } from '../types';

/** Mesmos indicadores do dashboard do desktop. */
export async function getDashboardData(targetYearMonth?: string): Promise<DashboardData> {
  const db = getDb();
  const period = resolveYearMonth(targetYearMonth);
  const previous = resolveYearMonth(shiftYearMonth(period.yearMonth, -1));

  const balanceSql = `SELECT SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END)
                           - SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS balance
                      FROM movements WHERE date <= ?`;
  const totalBalance = (await db.first<any>(balanceSql, [period.end]))?.balance || 0;
  const previousBalance = (await db.first<any>(balanceSql, [previous.end]))?.balance || 0;

  const summarySql = `SELECT SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS income,
                             SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS expense
                      FROM movements WHERE date >= ? AND date <= ?`;
  const current = await db.first<any>(summarySql, [period.start, period.end]);
  const prev = await db.first<any>(summarySql, [previous.start, previous.end]);
  const monthIncome = current?.income || 0;
  const monthExpense = current?.expense || 0;

  const fixedTotalSql = `SELECT SUM(amount) AS total FROM fixed_expenses
     WHERE active = 1 AND COALESCE(type, 'EXPENSE') = 'EXPENSE'
       AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)`;
  const fixedExpensesTotal = (await db.first<any>(fixedTotalSql, [period.end, period.start]))?.total || 0;

  const monthlyHistory: DashboardData['monthlyHistory'] = [];
  for (let i = 4; i >= 0; i--) {
    const p = resolveYearMonth(shiftYearMonth(period.yearMonth, -i));
    const row = await db.first<any>(summarySql, [p.start, p.end]);
    monthlyHistory.push({ month: monthShortLabel(p.month), income: row?.income || 0, expense: row?.expense || 0 });
  }

  const expensesByCategory = (
    await db.all<any>(
      `SELECT c.id, c.name AS label, c.color, SUM(m.amount) AS value
       FROM movements m JOIN categories c ON m.category_id = c.id
       WHERE m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?
       GROUP BY c.id, c.name, c.color ORDER BY value DESC`,
      [period.start, period.end]
    )
  ).map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#94a3b8' }));

  const expensesByCard = (
    await db.all<any>(
      `SELECT cc.id, cc.description AS label, cc.color, SUM(m.amount) AS value
       FROM movements m JOIN credit_cards cc ON m.credit_card_id = cc.id
       WHERE m.type = 'EXPENSE' AND m.date >= ? AND m.date <= ?
       GROUP BY cc.id, cc.description, cc.color ORDER BY value DESC`,
      [period.start, period.end]
    )
  ).map((r) => ({ id: r.id, label: r.label, value: r.value, color: r.color || '#8b5cf6' }));

  const upcomingFixedExpenses = (
    await db.all<any>(
      `SELECT f.*, c.name AS category_name, c.color AS category_color,
              CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS paid
       FROM fixed_expenses f
       LEFT JOIN categories c ON f.category_id = c.id
       LEFT JOIN fixed_expense_payments p ON p.fixed_expense_id = f.id AND p.year_month = ?
       WHERE f.active = 1 AND COALESCE(f.type, 'EXPENSE') = 'EXPENSE'
         AND f.start_date <= ? AND (f.end_date IS NULL OR f.end_date >= ?)
       ORDER BY f.due_day ASC`,
      [period.yearMonth, period.end, period.start]
    )
  ).map((f) => {
    const day = Math.min(f.due_day, period.lastDay);
    return {
      ...f,
      formattedDueDate: `${String(day).padStart(2, '0')}/${String(period.month).padStart(2, '0')}/${period.year}`,
    };
  });

  const fixedExpensesHistory: DashboardData['fixedExpensesHistory'] = [];
  for (let offset = -1; offset <= 10; offset++) {
    const p = resolveYearMonth(shiftYearMonth(period.yearMonth, offset));
    const row = await db.first<any>(fixedTotalSql, [p.end, p.start]);
    fixedExpensesHistory.push({ month: monthShortLabel(p.month), yearMonth: p.yearMonth, value: row?.total || 0 });
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
}
