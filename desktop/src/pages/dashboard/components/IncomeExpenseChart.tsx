import React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Paper } from '@mui/material';

interface IncomeExpenseChartProps {
  data: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
}

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  return (
    <Paper className="p-6 border border-slate-100 shadow-sm rounded-3xl bg-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-900">Comparativo Mensal</h3>
          <p className="text-xs text-slate-400 mt-0.5">Receitas versus Despesas (Últimos 5 meses)</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Receitas
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-900" /> Despesas
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-slate-400 text-sm">
          Sem dados suficientes no período.
        </div>
      ) : (
        <div className="w-full h-[260px]">
          <BarChart
            dataset={data}
            xAxis={[{ scaleType: 'band', dataKey: 'month' }]}
            series={[
              { dataKey: 'income', label: 'Receitas', color: '#10b981' },
              { dataKey: 'expense', label: 'Despesas', color: '#0f172a' },
            ]}
            height={260}
            borderRadius={4}
            margin={{ top: 10, bottom: 25, left: 55, right: 10 }}
            slotProps={{
              legend: { hidden: true },
            }}
          />
        </div>
      )}
    </Paper>
  );
}
