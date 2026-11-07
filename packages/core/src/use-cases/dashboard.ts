import { monthShortLabel, percentChange, resolveYearMonth, shiftYearMonth } from '../domain/date';
import type { DashboardQueries } from '../domain/repositories';
import type { DashboardData } from '../domain/types';

/** Indicadores do dashboard na visão da família (mesmos da v1, sem transferências). */
export class GetDashboard {
  constructor(private readonly queries: DashboardQueries) {}

  async execute(targetYearMonth?: string): Promise<DashboardData> {
    const period = resolveYearMonth(targetYearMonth);
    const previous = resolveYearMonth(shiftYearMonth(period.yearMonth, -1));

    const [totalBalance, previousBalance, current, prev, fixedExpensesTotal, expensesByCategory, expensesByCard, upcoming] =
      await Promise.all([
        this.queries.balanceUntil(period.end),
        this.queries.balanceUntil(previous.end),
        this.queries.totals(period.start, period.end),
        this.queries.totals(previous.start, previous.end),
        this.queries.fixedExpensesTotal(period.start, period.end),
        this.queries.expensesByCategory(period.start, period.end),
        this.queries.expensesByCard(period.start, period.end),
        this.queries.upcomingFixedExpenses(period.yearMonth, period.start, period.end),
      ]);

    const monthlyHistory: DashboardData['monthlyHistory'] = [];
    for (let i = 4; i >= 0; i--) {
      const p = resolveYearMonth(shiftYearMonth(period.yearMonth, -i));
      const totals = await this.queries.totals(p.start, p.end);
      monthlyHistory.push({ month: monthShortLabel(p.month), yearMonth: p.yearMonth, ...totals });
    }

    const fixedExpensesHistory: DashboardData['fixedExpensesHistory'] = [];
    for (let offset = -1; offset <= 10; offset++) {
      const p = resolveYearMonth(shiftYearMonth(period.yearMonth, offset));
      fixedExpensesHistory.push({
        month: monthShortLabel(p.month),
        yearMonth: p.yearMonth,
        value: await this.queries.fixedExpensesTotal(p.start, p.end),
      });
    }

    return {
      totalBalance,
      monthIncome: current.income,
      monthExpense: current.expense,
      fixedExpensesTotal,
      balanceTrend: percentChange(totalBalance, previousBalance),
      incomeTrend: percentChange(current.income, prev.income),
      expenseTrend: percentChange(current.expense, prev.expense),
      monthlyHistory,
      expensesByCategory,
      expensesByCard,
      upcomingFixedExpenses: upcoming.map((f) => {
        const day = Math.min(f.due_day, period.lastDay);
        return {
          ...f,
          formattedDueDate: `${String(day).padStart(2, '0')}/${String(period.month).padStart(2, '0')}/${period.year}`,
        };
      }),
      fixedExpensesHistory,
    };
  }
}
