import React from 'react';
import { Paper } from '@mui/material';

interface MovementSummaryProps {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  incomeCount?: number;
  expenseCount?: number;
}

export function MovementSummary({
  totalIncome,
  totalExpense,
  netBalance,
  incomeCount = 0,
  expenseCount = 0,
}: MovementSummaryProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Total de Entradas */}
      <Paper className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          Total de entradas
        </span>
        <p className="text-3xl font-extrabold text-emerald-600 mt-2 font-mono">
          +{formatCurrency(totalIncome)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {incomeCount} {incomeCount === 1 ? 'receita' : 'receitas'} no período selecionado
        </p>
      </Paper>

      {/* Total de Saídas */}
      <Paper className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          Total de saídas
        </span>
        <p className="text-3xl font-extrabold text-red-600 mt-2 font-mono">
          -{formatCurrency(totalExpense)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {expenseCount} {expenseCount === 1 ? 'despesa' : 'despesas'} no período selecionado
        </p>
      </Paper>

      {/* Saldo do Período */}
      <Paper className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          Saldo do período
        </span>
        <p
          className={`text-3xl font-extrabold mt-2 font-mono ${
            netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {netBalance >= 0 ? '+' : ''}
          {formatCurrency(netBalance)}
        </p>
        <p className="text-xs text-slate-400 mt-1">Resultado líquido entre entradas e saídas</p>
      </Paper>
    </div>
  );
}
