import React from 'react';
import { Paper } from '@mui/material';

interface CreditCardBarChartProps {
  data: Array<{
    id: string;
    label: string;
    value: number;
    color: string;
  }>;
}

export function CreditCardBarChart({ data }: CreditCardBarChartProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Paper className="p-6 border border-slate-100 shadow-sm rounded-3xl bg-white space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-slate-900">Gastos por Cartão de Crédito</h3>
            <p className="text-xs text-slate-400 mt-0.5">Comparativo do total gasto por cartão no mês atual</p>
          </div>

          {/* Top Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {data.map((item) => (
              <span key={item.id} className="flex items-center gap-1.5 font-medium text-slate-700">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate max-w-[120px]">{item.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          Nenhum gasto em cartão no mês atual.
        </div>
      ) : (
        <div className="pt-6 pb-2">
          <div className="h-44 flex items-end justify-around gap-4 px-4 border-b border-slate-100 pb-2">
            {data.map((card) => {
              const heightPercent = Math.max(12, Math.round((card.value / maxValue) * 100));
              return (
                <div key={card.id} className="flex-1 flex flex-col items-center gap-2 max-w-[56px] group">
                  <div className="w-full flex items-end justify-center h-36">
                    <div
                      className="w-3 sm:w-3.5 rounded-full transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: card.color,
                      }}
                      title={`${card.label}: ${formatCurrency(card.value)}`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 font-mono text-center whitespace-nowrap">
                    {formatCurrency(card.value)}
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
