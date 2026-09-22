import React from 'react';
import { Paper } from '@mui/material';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KpiCardsProps {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  fixedExpensesTotal?: number;
  balanceTrend?: number;
  incomeTrend?: number;
  expenseTrend?: number;
}

export function KpiCards({
  totalBalance,
  monthIncome,
  monthExpense,
  balanceTrend = 4.2,
  incomeTrend = 12.5,
  expenseTrend = -2.1,
}: KpiCardsProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Saldo Total */}
      <Paper className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Saldo Total
          </span>
          <p className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
            {formatCurrency(totalBalance)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {balanceTrend >= 0 ? `+${balanceTrend.toFixed(1)}%` : `${balanceTrend.toFixed(1)}%`}
            </span>
            <span className="text-xs text-slate-400">em relação ao mês anterior</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <Wallet className="w-5 h-5" />
        </div>
      </Paper>

      {/* Receitas no Mês */}
      <Paper className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Receitas no Mês
          </span>
          <p className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
            {formatCurrency(monthIncome)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {incomeTrend >= 0 ? `+${incomeTrend.toFixed(1)}%` : `${incomeTrend.toFixed(1)}%`}
            </span>
            <span className="text-xs text-slate-400">em relação ao mês anterior</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <ArrowUpRight className="w-5 h-5" />
        </div>
      </Paper>

      {/* Despesas no Mês */}
      <Paper className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Despesas no Mês
          </span>
          <p className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
            {formatCurrency(monthExpense)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
              <ArrowDownRight className="w-3 h-3" />
              {expenseTrend <= 0 ? `${expenseTrend.toFixed(1)}%` : `+${expenseTrend.toFixed(1)}%`}
            </span>
            <span className="text-xs text-slate-400">em relação ao mês anterior</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
          <ArrowDownRight className="w-5 h-5" />
        </div>
      </Paper>
    </div>
  );
}
