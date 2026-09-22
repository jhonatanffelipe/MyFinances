import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
} from '@mui/material';
import { AlertTriangle, ArrowDownLeft, CheckCircle2 } from 'lucide-react';
import { ImportPreviewItem } from '../../../interfaces/IElectronBridge';
import { Category } from '../../../types/database';

interface ImportTableProps {
  items: ImportPreviewItem[];
  categories: Category[];
  onToggleSelect: (id: string) => void;
  onSelectAllVisible: () => void;
  onDeselectAllVisible: () => void;
  onChangeCategory: (id: string, categoryId: number | null) => void;
}

export function ImportTable({
  items,
  categories,
  onToggleSelect,
  onSelectAllVisible,
  onDeselectAllVisible,
  onChangeCategory,
}: ImportTableProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const allVisibleSelected = items.length > 0 && items.every((i) => i.selected);
  const someVisibleSelected = items.some((i) => i.selected) && !allVisibleSelected;

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      onDeselectAllVisible();
    } else {
      onSelectAllVisible();
    }
  };

  if (items.length === 0) {
    return (
      <Paper className="p-12 text-center rounded-2xl border border-slate-100 bg-white shadow-sm">
        <p className="text-sm font-semibold text-slate-700">Nenhum lançamento corresponde ao filtro atual.</p>
        <p className="text-xs text-slate-400 mt-1">Tente alterar o termo de busca ou limpar os filtros de status.</p>
      </Paper>
    );
  }

  return (
    <Paper className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
      <TableContainer className="max-h-[620px]">
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow className="bg-slate-50">
              <TableCell padding="checkbox" className="bg-slate-50 w-12">
                <Checkbox
                  size="small"
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onChange={handleHeaderCheckboxChange}
                  color="success"
                />
              </TableCell>
              <TableCell className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider w-28">
                Data
              </TableCell>
              <TableCell className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                Descrição / Estabelecimento
              </TableCell>
              <TableCell className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider w-64">
                Categoria
              </TableCell>
              <TableCell className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider text-right w-36">
                Valor
              </TableCell>
              <TableCell className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider w-64">
                Status / Conciliação
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {items.map((item) => {
              const isExpense = item.type === 'EXPENSE';
              const isDuplicate = item.potentialDuplicate.isDuplicate;
              const isPayment = item.isInvoicePayment;

              return (
                <TableRow
                  key={item.id}
                  hover
                  className={`transition-colors ${
                    !item.selected
                      ? 'opacity-60 bg-slate-50/40'
                      : isDuplicate
                      ? 'bg-amber-50/20'
                      : isPayment
                      ? 'bg-indigo-50/20'
                      : ''
                  }`}
                >
                  {/* Checkbox */}
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={item.selected}
                      onChange={() => onToggleSelect(item.id)}
                      color="success"
                    />
                  </TableCell>

                  {/* Data */}
                  <TableCell className="text-xs font-mono text-slate-600 whitespace-nowrap">
                    {formatDate(item.date)}
                  </TableCell>

                  {/* Descrição */}
                  <TableCell className="text-xs font-medium text-slate-800">
                    <span className="block truncate max-w-md" title={item.description}>
                      {item.description}
                    </span>
                  </TableCell>

                  {/* Seletor de Categoria */}
                  <TableCell>
                    <FormControl fullWidth size="small">
                      <Select
                        value={item.categoryId ?? ''}
                        onChange={(e) =>
                          onChangeCategory(item.id, e.target.value ? Number(e.target.value) : null)
                        }
                        displayEmpty
                        className="text-xs rounded-xl bg-slate-50/80 h-8"
                      >
                        <MenuItem value="" className="text-xs text-slate-400">
                          <em>(Sem categoria)</em>
                        </MenuItem>
                        {categories.map((cat) => (
                          <MenuItem key={cat.id} value={cat.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat.color || '#94a3b8' }}
                              />
                              <span className="truncate">{cat.name}</span>
                            </div>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>

                  {/* Valor */}
                  <TableCell className="text-right whitespace-nowrap font-mono text-xs font-bold">
                    <span className={isExpense ? 'text-rose-600' : 'text-emerald-600'}>
                      {isExpense ? '- ' : '+ '}
                      {formatCurrency(item.amount)}
                    </span>
                  </TableCell>

                  {/* Status / Alertas */}
                  <TableCell>
                    {isDuplicate ? (
                      <Tooltip title={item.potentialDuplicate.reason || ''} arrow>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200 cursor-help max-w-full">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span className="truncate">
                            {item.potentialDuplicate.reason || 'Possível duplicata'}
                          </span>
                        </div>
                      </Tooltip>
                    ) : isPayment ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-medium border border-indigo-200">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span>Pagamento de fatura</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span>Pronto para importar</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
