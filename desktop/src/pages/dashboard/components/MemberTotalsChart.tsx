import { Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { Users } from 'lucide-react';
import type { DashboardData } from '../../../types/database';

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

/** Receita × despesa de cada membro no mês (sempre da família toda, sem transferências). */
export function MemberTotalsChart({ data, highlightId }: { data: DashboardData['byMember']; highlightId: string | null }) {
  return (
    <Paper className="p-6 border border-slate-100 shadow-sm rounded-3xl bg-white space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> Por membro
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Receitas e despesas de cada membro no mês (sem transferências)</p>
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
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Nenhum lançamento no mês.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-center">
          <div className="w-full h-[220px]">
            <BarChart
              dataset={data.map((m) => ({ name: m.name.split(' ')[0], income: m.income, expense: m.expense }))}
              xAxis={[{ scaleType: 'band', dataKey: 'name' }]}
              series={[
                { dataKey: 'income', label: 'Receitas', color: '#10b981', valueFormatter: (v) => formatCurrency(v ?? 0) },
                { dataKey: 'expense', label: 'Despesas', color: '#0f172a', valueFormatter: (v) => formatCurrency(v ?? 0) },
              ]}
              height={220}
              borderRadius={4}
              margin={{ top: 10, bottom: 25, left: 60, right: 10 }}
              slotProps={{ legend: { hidden: true } }}
            />
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {data.map((m) => (
              <div
                key={m.memberId}
                className={`py-2 px-2 flex items-center justify-between gap-3 rounded-lg ${m.memberId === highlightId ? 'bg-emerald-50/70' : ''}`}
              >
                <span className="font-semibold text-slate-800 truncate">{m.name}</span>
                <span className="font-mono text-right">
                  <span className="text-emerald-700">+{formatCurrency(m.income)}</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-900">-{formatCurrency(m.expense)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Paper>
  );
}
