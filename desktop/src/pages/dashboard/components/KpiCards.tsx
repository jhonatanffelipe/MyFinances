import React from 'react';
import { Paper } from '@mui/material';
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Wallet } from 'lucide-react';

interface KpiCardsProps {
  /** "da família", "seu" ou "de Beto": compõe os rótulos dos cards. */
  viewLabel: { balance: string; income: string; expense: string };
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  balanceTrend: number;
  incomeTrend: number;
  expenseTrend: number;
  /** Só na visão de membro. */
  transfers?: { transferIn: number; transferOut: number } | null;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

/** Variação em relação ao mês anterior; `goodWhenUp` define se subir é bom (verde) ou ruim (vermelho). */
function Trend({ value, goodWhenUp }: { value: number; goodWhenUp: boolean }) {
  const up = value >= 0;
  const good = up === goodWhenUp || value === 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md ${
          good ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
        }`}
      >
        <Icon className="w-3 h-3" />
        {up ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`}
      </span>
      <span className="text-xs text-slate-400">em relação ao mês anterior</span>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, iconClass, children }: { label: string; value: number; icon: React.ElementType; iconClass: string; children?: React.ReactNode }) {
  return (
    <Paper className="p-6 border border-slate-100 shadow-sm rounded-2xl bg-white flex items-start justify-between">
      <div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{label}</span>
        <p className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">{formatCurrency(value)}</p>
        {children}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
    </Paper>
  );
}

export function KpiCards({ viewLabel, totalBalance, monthIncome, monthExpense, balanceTrend, incomeTrend, expenseTrend, transfers }: KpiCardsProps) {
  const hasTransfers = !!transfers && (transfers.transferIn > 0 || transfers.transferOut > 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Kpi label={viewLabel.balance} value={totalBalance} icon={Wallet} iconClass="bg-emerald-50 text-emerald-600">
          <Trend value={balanceTrend} goodWhenUp />
        </Kpi>
        <Kpi label={viewLabel.income} value={monthIncome} icon={ArrowUpRight} iconClass="bg-emerald-50 text-emerald-600">
          <Trend value={incomeTrend} goodWhenUp />
        </Kpi>
        <Kpi label={viewLabel.expense} value={monthExpense} icon={ArrowDownRight} iconClass="bg-red-50 text-red-600">
          <Trend value={expenseTrend} goodWhenUp={false} />
        </Kpi>
      </div>
      {hasTransfers && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-800">
          <ArrowLeftRight className="w-4 h-4 flex-shrink-0 text-blue-600" />
          <span>
            Transferências no mês: recebeu <strong className="font-mono">{formatCurrency(transfers!.transferIn)}</strong> e enviou{' '}
            <strong className="font-mono">{formatCurrency(transfers!.transferOut)}</strong>. Entram no saldo, mas não em receitas e
            despesas.
          </span>
        </div>
      )}
    </div>
  );
}
