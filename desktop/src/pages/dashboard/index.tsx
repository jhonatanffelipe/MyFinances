import React from 'react';
import { CircularProgress, IconButton, Tooltip, Button } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboard } from './hooks/useDashboard';
import { KpiCards } from './components/KpiCards';
import { IncomeExpenseChart } from './components/IncomeExpenseChart';
import { CategoryPieChart } from './components/CategoryPieChart';
import { CreditCardBarChart } from './components/CreditCardBarChart';
import { CreditCardPieChart } from './components/CreditCardPieChart';
import { FixedExpensesChart } from './components/FixedExpensesChart';
import { MemberTotalsChart } from './components/MemberTotalsChart';
import { UpcomingFixedExpensesList } from './components/UpcomingFixedExpensesList';
import { ViewSelector } from '../../components/Members/ViewSelector';
import { useAppState } from '../../contexts/AppStateContext';
import type { DashboardData } from '../../types/database';

/** Rótulos dos KPIs conforme a visão: "Saldo da família" / "Seu saldo" / "Saldo de Beto". */
function viewLabels(view: DashboardData['view'], myId: string | undefined) {
  if (!view.memberId) return { balance: 'Saldo da família', income: 'Receitas da família no mês', expense: 'Despesas da família no mês' };
  if (view.memberId === myId) return { balance: 'Seu saldo', income: 'Suas receitas no mês', expense: 'Suas despesas no mês' };
  const name = view.memberName?.split(' ')[0] ?? 'membro';
  return { balance: `Saldo de ${name}`, income: `Receitas de ${name} no mês`, expense: `Despesas de ${name} no mês` };
}

export function DashboardPage() {
  const {
    selectedYearMonth,
    setSelectedYearMonth,
    handlePreviousMonth,
    handleNextMonth,
    handleCurrentMonth,
    data,
    loading,
    error,
  } = useDashboard();
  const { state } = useAppState();

  return (
    <div className="space-y-6 pt-1">
      {/* Month Navigation Selector */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <ViewSelector />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-2xl border border-slate-100 shadow-sm">
            <Tooltip title="Mês anterior">
              <IconButton
                size="small"
                onClick={handlePreviousMonth}
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-xl transition-colors"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </IconButton>
            </Tooltip>

            <div className="flex items-center gap-2 px-1 sm:px-2">
              <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <DatePicker
                views={['year', 'month']}
                format="MMMM [de] YYYY"
                value={selectedYearMonth ? dayjs(selectedYearMonth) : null}
                onChange={(val) => {
                  if (val && val.isValid()) {
                    setSelectedYearMonth(val.format('YYYY-MM'));
                  }
                }}
                slotProps={{
                  textField: {
                    size: 'small',
                    variant: 'standard',
                    InputProps: { disableUnderline: true },
                    className: 'text-sm font-bold text-slate-800 capitalize w-40 sm:w-48 text-center',
                  },
                }}
              />
            </div>

            <Tooltip title="Próximo mês">
              <IconButton
                size="small"
                onClick={handleNextMonth}
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-xl transition-colors"
                aria-label="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </IconButton>
            </Tooltip>
          </div>

          <Tooltip title="Ir para o mês atual">
            <Button
              size="small"
              variant="outlined"
              onClick={handleCurrentMonth}
              className="rounded-2xl border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/50 normal-case font-semibold text-xs py-1.5 px-3 h-10 shadow-sm bg-white"
            >
              Mês atual
            </Button>
          </Tooltip>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center items-center py-20">
          <CircularProgress color="success" />
        </div>
      ) : (
        data && (
          <>
            {/* KPI Summary Cards */}
            <KpiCards
              viewLabel={viewLabels(data.view, state.user?.id)}
              totalBalance={data.totalBalance}
              monthIncome={data.monthIncome}
              monthExpense={data.monthExpense}
              balanceTrend={data.balanceTrend}
              incomeTrend={data.incomeTrend}
              expenseTrend={data.expenseTrend}
              transfers={data.view.memberId ? { transferIn: data.transferIn, transferOut: data.transferOut } : null}
            />

            {/* Receita × despesa de cada membro (só faz sentido com mais de um) */}
            {state.members.length > 1 && <MemberTotalsChart data={data.byMember} highlightId={data.view.memberId} />}

            {/* 2x2 Charts Section matching Figma Screen 06 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <IncomeExpenseChart data={data.monthlyHistory} />
              <CategoryPieChart data={data.expensesByCategory} />
              <CreditCardBarChart data={data.expensesByCard || []} />
              <CreditCardPieChart data={data.expensesByCard || []} />
            </div>

            {/* Projeção de Despesas Fixas (12 meses) */}
            <FixedExpensesChart
              data={data.fixedExpensesHistory || []}
              currentYearMonth={selectedYearMonth}
            />

            <UpcomingFixedExpensesList expenses={data.upcomingFixedExpenses} />
          </>
        )
      )}
    </div>
  );
}
