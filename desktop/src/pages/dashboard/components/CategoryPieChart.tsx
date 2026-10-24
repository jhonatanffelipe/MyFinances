import React from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { Paper } from '@mui/material';

interface CategoryPieChartProps {
  data: Array<{
    id: number;
    label: string;
    value: number;
    color: string;
  }>;
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const pieSeriesData = data.map((item) => ({
    id: item.id,
    value: item.value,
    label: item.label,
    color: item.color,
  }));

  return (
    <Paper className="p-6 border border-slate-100 shadow-sm rounded-3xl bg-white space-y-4">
      <div>
        <h3 className="font-bold text-base text-slate-900">Gastos por Categoria</h3>
        <p className="text-xs text-slate-400 mt-0.5">Distribuição de despesas no período atual</p>
      </div>

      {data.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-slate-400 text-sm">
          Nenhuma despesa registrada neste mês.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
          {/* Donut Chart with Center Text */}
          <div className="relative w-48 h-48 flex-shrink-0 flex items-center justify-center">
            <PieChart
              series={[
                {
                  data: pieSeriesData,
                  innerRadius: 55,
                  outerRadius: 85,
                  paddingAngle: 2,
                  cornerRadius: 4,
                },
              ]}
              height={190}
              width={190}
              slotProps={{
                legend: { hidden: true },
              }}
              margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-extrabold text-slate-800">100%</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>

          {/* Detailed Legend List */}
          <div className="flex-1 w-full space-y-2">
            {data.map((cat) => {
              const percent = totalValue > 0 ? Math.round((cat.value / totalValue) * 100) : 0;
              return (
                <div key={cat.id} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-slate-700 font-medium truncate">{cat.label}</span>
                  </div>
                  <span className="text-slate-500 font-semibold font-mono ml-2">
                    {percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Paper>
  );
}
