import React from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { Paper } from '@mui/material';

interface CreditCardPieChartProps {
  data: Array<{
    id: number;
    label: string;
    value: number;
    color: string;
  }>;
}

export function CreditCardPieChart({ data }: CreditCardPieChartProps) {
  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
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
        <h3 className="font-bold text-base text-slate-900">Participação no Total</h3>
        <p className="text-xs text-slate-400 mt-0.5">Distribuição dos gastos por cartão no mês atual</p>
      </div>

      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          Nenhum gasto em cartão no mês atual.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
          {/* Donut Chart with Center Text */}
          <div className="relative w-44 h-44 flex-shrink-0 flex items-center justify-center">
            <PieChart
              series={[
                {
                  data: pieSeriesData,
                  innerRadius: 50,
                  outerRadius: 80,
                  paddingAngle: 2,
                  cornerRadius: 4,
                },
              ]}
              height={180}
              width={180}
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
            {data.map((card) => {
              const percent = totalValue > 0 ? Math.round((card.value / totalValue) * 100) : 0;
              return (
                <div key={card.id} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: card.color }}
                    />
                    <span className="text-slate-700 font-medium truncate">{card.label}</span>
                  </div>
                  <span className="text-slate-500 font-semibold font-mono ml-2 whitespace-nowrap">
                    {percent}% · {formatCurrency(card.value)}
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
