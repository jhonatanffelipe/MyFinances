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
} from '@mui/material';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
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
}: MovementTableProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMovement, setActiveMovement] = useState<Movement | null>(null);

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
              <TableCell width={60} className="font-bold text-xs text-slate-500 uppercase">
                Ações
              </TableCell>
              <TableCell width={140} className="font-bold text-xs text-slate-500 uppercase">
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
              movements.map((row) => (
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
                  <TableCell className="text-sm text-slate-600">
                    {row.category_name || 'Sem categoria'}
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
              ))
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
        <MenuItem
          onClick={() => {
            if (activeMovement) onEdit(activeMovement);
            handleCloseMenu();
          }}
          className="text-xs font-semibold text-slate-700 flex items-center gap-2 py-2"
        >
          <Edit2 className="w-3.5 h-3.5 text-blue-600" /> Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeMovement) onDelete(activeMovement.id);
            handleCloseMenu();
          }}
          className="text-xs font-semibold text-red-600 flex items-center gap-2 py-2"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" /> Excluir
        </MenuItem>
      </Menu>
    </Paper>
  );
}
