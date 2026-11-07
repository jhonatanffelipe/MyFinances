import { monthShortLabel, percentChange, resolveYearMonth, shiftYearMonth } from '../domain/date';
import type { DashboardQueries, DashboardScope } from '../domain/repositories';
import type { DashboardData, Uuid } from '../domain/types';
import { AppError } from '../errors/AppError';

const HISTORY_MONTHS = 5;
/** Histórico de fixos: do mês anterior até 10 meses à frente. */
const FIXED_HISTORY = { from: -1, to: 10 };

export interface DashboardOptions {
  /** Visão de um membro; nulo/ausente = família inteira. */
  memberId?: Uuid | null;
}

/**
 * Indicadores do dashboard calculados no SQLite local. Na visão família, soma todos os
 * membros e ignora transferências entre eles; na visão de um membro, mostra só os
 * lançamentos dele, e as transferências entram no saldo e em transferIn/transferOut.
 */
export class GetDashboard {
  constructor(private readonly queries: DashboardQueries) {}

  async execute(targetYearMonth?: string, options: DashboardOptions = {}): Promise<DashboardData> {
    const scope: DashboardScope = { memberId: options.memberId || null };
    let memberName: string | null = null;
    if (scope.memberId) {
      memberName = await this.queries.memberName(scope.memberId);
      if (memberName === null) throw new AppError('NOT_MEMBER', 'Esse membro não faz parte da família', { field: 'memberId' });
    }

    const period = resolveYearMonth(targetYearMonth);
    const previous = resolveYearMonth(shiftYearMonth(period.yearMonth, -1));
    const historyStart = resolveYearMonth(shiftYearMonth(period.yearMonth, -(HISTORY_MONTHS - 1)));
    const fixedStart = resolveYearMonth(shiftYearMonth(period.yearMonth, FIXED_HISTORY.from));
    const fixedEnd = resolveYearMonth(shiftYearMonth(period.yearMonth, FIXED_HISTORY.to));

    const [totalBalance, previousBalance, monthly, transfers, fixed, expensesByCategory, expensesByCard, byMember, upcoming] =
      await Promise.all([
        this.queries.balanceUntil(period.end, scope),
        this.queries.balanceUntil(previous.end, scope),
        // Uma consulta agrupada cobre o histórico, o mês atual e o anterior
        this.queries.monthlyTotals(historyStart.start, period.end, scope),
        this.queries.transfers(period.start, period.end, scope),
        this.queries.activeFixedExpenses(fixedStart.start, fixedEnd.end, scope),
        this.queries.expensesByCategory(period.start, period.end, scope),
        this.queries.expensesByCard(period.start, period.end, scope),
        this.queries.byMember(period.start, period.end),
        this.queries.upcomingFixedExpenses(period.yearMonth, period.start, period.end, scope),
      ]);

    const totalsOf = (yearMonth: string) => {
      const row = monthly.find((r) => r.yearMonth === yearMonth);
      return { income: Number(row?.income ?? 0), expense: Number(row?.expense ?? 0) };
    };
    const current = totalsOf(period.yearMonth);
    const prev = totalsOf(previous.yearMonth);

    const monthlyHistory: DashboardData['monthlyHistory'] = [];
    for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
      const p = resolveYearMonth(shiftYearMonth(period.yearMonth, -i));
      monthlyHistory.push({ month: monthShortLabel(p.month), yearMonth: p.yearMonth, ...totalsOf(p.yearMonth) });
    }

    const fixedTotal = (start: string, end: string) =>
      fixed.filter((f) => f.start_date <= end && (!f.end_date || f.end_date >= start)).reduce((sum, f) => sum + Number(f.amount), 0);

    const fixedExpensesHistory: DashboardData['fixedExpensesHistory'] = [];
    for (let offset = FIXED_HISTORY.from; offset <= FIXED_HISTORY.to; offset++) {
      const p = resolveYearMonth(shiftYearMonth(period.yearMonth, offset));
      fixedExpensesHistory.push({ month: monthShortLabel(p.month), yearMonth: p.yearMonth, value: fixedTotal(p.start, p.end) });
    }

    return {
      view: { memberId: scope.memberId, memberName },
      totalBalance,
      monthIncome: current.income,
      monthExpense: current.expense,
      fixedExpensesTotal: fixedTotal(period.start, period.end),
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
      transferIn: Number(transfers.transferIn),
      transferOut: Number(transfers.transferOut),
      byMember: byMember.map((m) => ({ memberId: m.member_id, name: m.name ?? 'Membro removido', income: Number(m.income), expense: Number(m.expense) })),
    };
  }
}
