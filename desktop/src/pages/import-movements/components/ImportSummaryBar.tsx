import React from 'react';
import { Layers, CheckCircle2, AlertTriangle, ArrowDownLeft } from 'lucide-react';
import { Paper } from '@mui/material';

interface ImportSummaryBarProps {
  totalCount: number;
  selectedCount: number;
  selectedTotalAmount: number;
  duplicateCount: number;
  invoicePaymentCount: number;
}

export function ImportSummaryBar({
  totalCount,
  selectedCount,
  selectedTotalAmount,
  duplicateCount,
  invoicePaymentCount,
}: ImportSummaryBarProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total de Linhas */}
      <Paper className="p-4 rounded-2xl border border-slate-100 shadow-sm bg-white flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs text-slate-400 font-medium block">Total no Arquivo</span>
          <span className="text-xl font-bold text-slate-800">{totalCount}</span>
          <span className="text-[11px] text-slate-400 block">lançamentos encontrados</span>
        </div>
      </Paper>

      {/* Selecionados para Importar */}
      <Paper className="p-4 rounded-2xl border border-emerald-100 shadow-sm bg-emerald-50/40 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs text-emerald-800 font-semibold block">Prontos para Importar</span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl font-bold text-emerald-950">
              {formatCurrency(selectedTotalAmount)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium block">
            {selectedCount} de {totalCount} selecionados
          </span>
        </div>
      </Paper>

      {/* Duplicatas Detectadas */}
      <Paper className="p-4 rounded-2xl border border-amber-100 shadow-sm bg-amber-50/30 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs text-amber-800 font-semibold block">Possíveis Duplicatas</span>
          <span className="text-xl font-bold text-amber-950">{duplicateCount}</span>
          <span className="text-[11px] text-amber-700 block">desmarcadas por padrão</span>
        </div>
      </Paper>

      {/* Pagamentos de Fatura */}
      <Paper className="p-4 rounded-2xl border border-slate-100 shadow-sm bg-white flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
          <ArrowDownLeft className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs text-slate-400 font-medium block">Pagamentos de Fatura</span>
          <span className="text-xl font-bold text-slate-800">{invoicePaymentCount}</span>
          <span className="text-[11px] text-slate-400 block">desmarcados por padrão</span>
        </div>
      </Paper>
    </div>
  );
}
