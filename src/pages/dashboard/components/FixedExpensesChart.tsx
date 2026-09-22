import React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Paper } from '@mui/material';

interface FixedExpensesChartProps {
  data: Array<{
    month: string;
    yearMonth: string;
    value: number;
  }>;
  currentYearMonth?: string;
}

export function FixedExpensesChart({ data, currentYearMonth }: FixedExpensesChartProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);
  const averageValue = data.length > 0 ? totalValue / data.length : 0;

  return (
    <Paper className="p-6 border border-slate-100 shadow-sm rounded-3xl bg-white space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-base text-slate-900">Projeção de Despesas Fixas</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            12 meses: 1 mês anterior, mês selecionado e próximos 10 meses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Despesas Fixas
          </div>
          <div className="text-slate-500">
            Média: <strong className="text-slate-800 font-semibold">{formatCurrency(averageValue)}</strong>/mês
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          Nenhuma despesa fixa ativa no período de 12 meses.
        </div>
      ) : (
        <div className="w-full h-[280px]">
          <BarChart
            dataset={data}
            xAxis={[
              {
                scaleType: 'band',
                dataKey: 'month',
                tickLabelStyle: {
                  fontSize: 11,
                  fontWeight: 600,
                  fill: '#64748b',
                },
              },
            ]}
            yAxis={[
              {
                valueFormatter: (v: number | null) => (v != null ? formatCurrency(v) : ''),
                tickLabelStyle: {
                  fontSize: 10,
                  fill: '#94a3b8',
                },
              },
            ]}
            series={[
              {
                dataKey: 'value',
                label: 'Despesas Fixas',
                color: '#6366f1',
                valueFormatter: (v: number | null) => (v != null ? formatCurrency(v) : ''),
              },
            ]}
            height={280}
            borderRadius={6}
            margin={{ top: 20, bottom: 30, left: 75, right: 20 }}
            slotProps={{
              legend: { hidden: true },
            }}
          />
        </div>
      )}
    </Paper>
  );
}
