import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Button,
} from '@mui/material';
import {
  MoreVertical,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  CreditCard as CreditCardIcon,
  Filter,
} from 'lucide-react';
import { Movement } from '../../../types/database';
import TablePagination from '../../../components/Table/TablePagination';

interface MovementTableProps {
  movements: Movement[];
  loading: boolean;
  totalRows: number;
  currentPage: number;
  perPage: number;
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setPerPage: React.Dispatch<React.SetStateAction<number>>;
  handlePagination: (
    perPage: number,
    currentPage: number,
    orderField: string,
    orderDirection: 'asc' | 'desc'
  ) => Promise<void> | void;
  onEdit: (mov: Movement) => void;
  onDelete: (id: number) => void;
  onFilterCard?: (cardId: number) => void;
}

export function MovementTable({
  movements,
  loading,
  totalRows,
  currentPage,
  perPage,
  orderField = 'date',
  orderDirection = 'desc',
  setCurrentPage,
  setPerPage,
  handlePagination,
  onEdit,
  onDelete,
  onFilterCard,
}: MovementTableProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMovement, setActiveMovement] = useState<Movement | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<number>>(new Set());

  const toggleExpandCard = (cardId: number) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthName = months[parseInt(m, 10) - 1] || m;
    return `${d} ${monthName} ${y}`;
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, mov: Movement) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setActiveMovement(mov);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveMovement(null);
  };

  if (loading && movements.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress color="success" />
      </div>
    );
  }

  return (
    <Paper className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
      <TableContainer>
        <Table>
          <TableHead className="bg-slate-50/50">
            <TableRow>
              <TableCell width={70} className="font-bold text-xs text-slate-500 uppercase">
                Ações
              </TableCell>
              <TableCell width={150} className="font-bold text-xs text-slate-500 uppercase">
                Data
              </TableCell>
              <TableCell className="font-bold text-xs text-slate-500 uppercase">
                Descrição
              </TableCell>
              <TableCell className="font-bold text-xs text-slate-500 uppercase">
                Categoria
              </TableCell>
              <TableCell width={120} className="font-bold text-xs text-slate-500 uppercase">
                Tipo
              </TableCell>
              <TableCell width={150} className="font-bold text-xs text-slate-500 uppercase text-right">
                Valor
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                  Nenhuma movimentação encontrada para o período selecionado.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((row) => {
                if (row.isGroupedCard) {
                  const cardId = row.credit_card_id || 0;
                  const isExpanded = expandedCardIds.has(cardId);
                  return (
                    <React.Fragment key={`grouped_card_${cardId}_${row.id}`}>
                      <TableRow
                        hover
                        onClick={() => toggleExpandCard(cardId)}
                        className={`transition-colors cursor-pointer ${
                          isExpanded ? 'bg-violet-50/40' : 'bg-slate-50/20'
                        }`}
                        style={{
                          borderLeft: `4px solid ${row.credit_card_color || '#8b5cf6'}`,
                        }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            <IconButton
                              size="small"
                              onClick={() => toggleExpandCard(cardId)}
                              className="text-slate-400 hover:text-slate-700"
                              title={isExpanded ? 'Recolher lançamentos' : 'Expandir lançamentos'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-violet-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              )}
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenMenu(e, row)}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </IconButton>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700 font-mono">
                          <div>
                            <span>{formatDate(row.date)}</span>
                            <span className="block text-[10px] text-violet-600 font-sans font-medium">
                              Vencimento
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-800 text-sm">{row.description}</p>
                              <span
                                className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${row.credit_card_color || '#8b5cf6'}18`,
                                  color: row.credit_card_color || '#8b5cf6',
                                }}
                              >
                                {row.cardMovementCount} lançamentos
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Fatura consolidada · Clique na linha para {isExpanded ? 'recolher' : 'expandir lançamentos'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: `${row.credit_card_color || '#8b5cf6'}18`,
                              borderColor: `${row.credit_card_color || '#8b5cf6'}30`,
                              color: row.credit_card_color || '#8b5cf6',
                            }}
                          >
                            <CreditCardIcon className="w-3.5 h-3.5 shrink-0" />
                            Fatura de Cartão
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Fatura
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-extrabold text-right font-mono text-slate-900">
                          - {formatCurrency(row.amount)}
                        </TableCell>
                      </TableRow>

                      {/* Sanfona expandida de lançamentos do cartão */}
                      {isExpanded && (
                        <TableRow className="bg-slate-50/70 border-b border-slate-200">
                          <TableCell colSpan={6} className="p-0">
                            <div className="p-3 pl-8 sm:pl-12 space-y-2.5 bg-gradient-to-b from-slate-50 to-slate-100/40">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: row.credit_card_color || '#8b5cf6' }}
                                  />
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                    Lançamentos inclusos na Fatura - {row.credit_card_name}
                                  </span>
                                  <span className="text-xs text-slate-500 font-medium">
                                    ({row.cardMovementCount} itens · Total: {formatCurrency(row.amount)})
                                  </span>
                                </div>

                                {onFilterCard && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => onFilterCard(cardId)}
                                    startIcon={<Filter className="w-3 h-3" />}
                                    className="text-[11px] font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 normal-case rounded-lg py-0.5 px-2.5"
                                  >
                                    Filtrar apenas este cartão na tela
                                  </Button>
                                )}
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase font-semibold">
                                    <tr>
                                      <th className="py-1.5 px-3">Data</th>
                                      <th className="py-1.5 px-3">Descrição</th>
                                      <th className="py-1.5 px-3">Categoria</th>
                                      <th className="py-1.5 px-3">Tipo</th>
                                      <th className="py-1.5 px-3 text-right">Valor</th>
                                      <th className="py-1.5 px-3 text-center w-20">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {row.cardMovements?.map((child) => (
                                      <tr key={child.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2 px-3 font-mono text-slate-600">
                                          {formatDate(child.date)}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-slate-800">
                                          {child.description}
                                          {child.notes && (
                                            <span className="block text-[10px] text-slate-400">
                                              {child.notes}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3">
                                          {child.category_name ? (
                                            <span
                                              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border"
                                              style={{
                                                backgroundColor: `${child.category_color || '#64748b'}18`,
                                                borderColor: `${child.category_color || '#64748b'}30`,
                                                color: child.category_color || '#475569',
                                              }}
                                            >
                                              <span
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: child.category_color || '#64748b' }}
                                              />
                                              <span>{child.category_name}</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                              Sem categoria
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3">
                                          {child.type === 'INCOME' ? (
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                              Entrada
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                              Saída
                                            </span>
                                          )}
                                        </td>
                                        <td
                                          className={`py-2 px-3 text-right font-mono font-bold ${
                                            child.type === 'INCOME'
                                              ? 'text-emerald-600'
                                              : 'text-slate-800'
                                          }`}
                                        >
                                          {child.type === 'INCOME' ? '+' : '-'}{' '}
                                          {formatCurrency(child.amount)}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => onEdit(child)}
                                              title="Editar lançamento"
                                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => onDelete(child.id)}
                                              title="Excluir lançamento"
                                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                }

                return (
                  <TableRow key={row.id} hover className="transition-colors">
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenMenu(e, row)}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </IconButton>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600 font-mono">
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{row.description}</p>
                        {row.credit_card_name && (
                          <span
                            className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5"
                            style={{
                              backgroundColor: `${row.credit_card_color || '#8b5cf6'}15`,
                              color: row.credit_card_color || '#8b5cf6',
                            }}
                          >
                            💳 {row.credit_card_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.category_name ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: `${row.category_color || '#64748b'}18`,
                            borderColor: `${row.category_color || '#64748b'}30`,
                            color: row.category_color || '#475569',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.category_color || '#64748b' }}
                          />
                          <span>{row.category_name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                          Sem categoria
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.type === 'INCOME' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Saída
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-sm font-bold text-right font-mono ${
                        row.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {row.type === 'INCOME' ? '+' : '-'} {formatCurrency(row.amount)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        totalRows={totalRows}
        currentPage={currentPage}
        perPage={perPage}
        handleRequest={handlePagination}
        setPerPage={setPerPage}
        setCurrentPage={setCurrentPage}
        orderField={orderField}
        orderDirection={orderDirection}
      />

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          className: 'rounded-xl shadow-lg border border-slate-100 min-w-[140px]',
        }}
      >
        {activeMovement?.isGroupedCard ? (
          [
            <MenuItem
              key="toggle-expand"
              onClick={() => {
                if (activeMovement.credit_card_id) {
                  toggleExpandCard(activeMovement.credit_card_id);
                }
                handleCloseMenu();
              }}
              className="text-xs font-semibold text-slate-700 flex items-center gap-2 py-2"
            >
              <CreditCardIcon className="w-3.5 h-3.5 text-violet-600" />
              {activeMovement.credit_card_id && expandedCardIds.has(activeMovement.credit_card_id)
                ? 'Recolher lançamentos'
                : 'Expandir lançamentos'}
            </MenuItem>,
            onFilterCard && activeMovement.credit_card_id ? (
              <MenuItem
                key="filter-card"
                onClick={() => {
                  onFilterCard(activeMovement.credit_card_id!);
                  handleCloseMenu();
                }}
                className="text-xs font-semibold text-purple-700 flex items-center gap-2 py-2"
              >
                <Filter className="w-3.5 h-3.5 text-purple-600" />
                Filtrar apenas este cartão
              </MenuItem>
            ) : null,
          ]
        ) : (
          [
            <MenuItem
              key="edit"
              onClick={() => {
                if (activeMovement) onEdit(activeMovement);
                handleCloseMenu();
              }}
              className="text-xs font-semibold text-slate-700 flex items-center gap-2 py-2"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600" /> Editar
            </MenuItem>,
            <MenuItem
              key="delete"
              onClick={() => {
                if (activeMovement) onDelete(activeMovement.id);
                handleCloseMenu();
              }}
              className="text-xs font-semibold text-red-600 flex items-center gap-2 py-2"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" /> Excluir
            </MenuItem>,
          ]
        )}
      </Menu>
    </Paper>
  );
}
