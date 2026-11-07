import React from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { Paper } from '@mui/material';
import { MemberAvatar } from '../../../components/Members/MemberAvatar';
import { FixedExpense } from '../../../types/database';

interface UpcomingFixedExpensesListProps {
  expenses: Array<FixedExpense & { formattedDueDate: string }>;
}

export function UpcomingFixedExpensesList({ expenses }: UpcomingFixedExpensesListProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <Paper className="p-6 border border-slate-200 shadow-sm rounded-2xl bg-white space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <CalendarClock className="w-5 h-5 text-amber-600" />
        <div>
          <h3 className="font-bold text-base text-slate-800">Despesas fixas do mês</h3>
          <p className="text-xs text-slate-500">Contas a vencer no período selecionado</p>
        </div>
      </div>

      {expenses.length === 0 ? (
        <p className="text-slate-400 text-sm py-4 text-center">Nenhuma despesa fixa vigente neste mês.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                  {exp.formattedDueDate}
                </span>
                {exp.category_name && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${exp.category_color}20` || '#f1f5f9',
                      color: exp.category_color || '#475569',
                    }}
                  >
                    {exp.category_name}
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800 truncate">{exp.description}</p>
                <p className="text-lg font-extrabold text-red-600 font-mono mt-0.5">
                  {formatCurrency(exp.amount)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-slate-600 font-semibold min-w-0">
                  {exp.member_name ? (
                    <>
                      <MemberAvatar name={exp.member_name} size={16} />
                      <span className="truncate">{exp.member_name}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Família</span>
                  )}
                </span>
                {exp.paid ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Paper>
  );
}
