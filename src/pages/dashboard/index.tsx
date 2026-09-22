import React from 'react';
import { CircularProgress } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Calendar } from 'lucide-react';
import { useDashboard } from './hooks/useDashboard';
import { KpiCards } from './components/KpiCards';
import { IncomeExpenseChart } from './components/IncomeExpenseChart';
import { CategoryPieChart } from './components/CategoryPieChart';
import { CreditCardBarChart } from './components/CreditCardBarChart';
import { CreditCardPieChart } from './components/CreditCardPieChart';
import { FixedExpensesChart } from './components/FixedExpensesChart';

export function DashboardPage() {
  const { selectedYearMonth, setSelectedYearMonth, data, loading, error } = useDashboard();

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex justify-end items-center -mt-2">
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
          <Calendar className="w-5 h-5 text-emerald-600 flex-shrink-0" />
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
                className: 'text-sm font-bold text-slate-800 capitalize w-48 sm:w-56',
              },
            }}
          />
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
              totalBalance={data.totalBalance}
              monthIncome={data.monthIncome}
              monthExpense={data.monthExpense}
              fixedExpensesTotal={data.fixedExpensesTotal}
              balanceTrend={data.balanceTrend}
              incomeTrend={data.incomeTrend}
              expenseTrend={data.expenseTrend}
            />

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
          </>
        )
      )}
    </div>
  );
}
