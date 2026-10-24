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
  TextField,
  InputAdornment,
  Button,
} from '@mui/material';
import { MoreVertical, Search, Filter, Edit2, Trash2 } from 'lucide-react';
import { FixedExpense } from '../../../types/database';
import TablePagination from '../../../components/Table/TablePagination';
import { FixedEntryCopy } from '../constants';

interface FixedEntryTableProps {
  copy: FixedEntryCopy;
  entries: FixedExpense[];
  loading: boolean;
  totalRows: number;
  currentPage: number;
  perPage: number;
  search: string;
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
  handleSearchChange: (value: string) => void;
  onEdit: (entry: FixedExpense) => void;
  onDelete: (id: number) => void;
}

export function FixedEntryTable({
  copy,
  entries,
  loading,
  totalRows,
  currentPage,
  perPage,
  search,
  orderField = 'due_day',
  orderDirection = 'asc',
  setCurrentPage,
  setPerPage,
  handlePagination,
  handleSearchChange,
  onEdit,
  onDelete,
}: FixedEntryTableProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeEntry, setActiveEntry] = useState<FixedExpense | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, entry: FixedExpense) => {
    setAnchorEl(event.currentTarget);
    setActiveEntry(entry);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveEntry(null);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress color="success" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="w-full sm:w-80">
          <TextField
            size="small"
            fullWidth
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-4 h-4 text-slate-400" />
                </InputAdornment>
              ),
              className: 'rounded-xl bg-slate-50/50 text-sm',
            }}
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <Button
            size="small"
            variant="outlined"
            startIcon={<Filter className="w-3.5 h-3.5" />}
            className="rounded-xl border-slate-200 text-slate-600 normal-case font-semibold text-xs"
          >
            Filtros avançados
          </Button>
          <span className="text-xs text-slate-400 font-medium">
            {totalRows} {totalRows === 1 ? copy.countSingular : copy.countPlural}
          </span>
        </div>
      </div>

      {/* Table */}
      <Paper className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
        <TableContainer>
          <Table>
            <TableHead className="bg-slate-50/50">
              <TableRow>
                <TableCell width={60} className="font-bold text-xs text-slate-500 uppercase">
                  Ações
                </TableCell>
                <TableCell width={80} className="font-bold text-xs text-slate-500 uppercase">
                  {copy.dayColumn}
                </TableCell>
                <TableCell className="font-bold text-xs text-slate-500 uppercase">
                  Descrição
                </TableCell>
                <TableCell className="font-bold text-xs text-slate-500 uppercase">
                  Categoria
                </TableCell>
                <TableCell width={140} className="font-bold text-xs text-slate-500 uppercase">
                  Recorrência
                </TableCell>
                <TableCell width={160} className="font-bold text-xs text-slate-500 uppercase text-right">
                  {copy.amountColumn}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    {copy.emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((row) => (
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
                    <TableCell className="font-bold text-xs text-slate-600 font-mono">
                      {copy.dayPrefix} {String(row.due_day).padStart(2, '0')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{row.description}</p>
                        {copy.showCreditCard && row.credit_card_name && (
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
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: row.category_color || '#94a3b8' }}
                        />
                        <span className="text-sm text-slate-600">{row.category_name || 'Sem categoria'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {row.recurrence === 'MONTHLY' && 'Mensal'}
                      {row.recurrence === 'BIMONTHLY' && 'Bimestral'}
                      {row.recurrence === 'QUARTERLY' && 'Trimestral'}
                      {row.recurrence === 'SEMIANNUAL' && 'Semestral'}
                      {row.recurrence === 'ANNUAL' && 'Anual'}
                      {!row.recurrence && 'Mensal'}
                    </TableCell>
                    <TableCell className={`text-sm font-bold text-right font-mono ${copy.amountClassName}`}>
                      {formatCurrency(row.amount)}
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
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          className: 'rounded-xl shadow-lg border border-slate-100 min-w-[170px]',
        }}
      >
        <MenuItem
          onClick={() => {
            if (activeEntry) onEdit(activeEntry);
            handleCloseMenu();
          }}
          className="text-xs font-semibold text-slate-700 flex items-center gap-2 py-2"
        >
          <Edit2 className="w-3.5 h-3.5 text-blue-600" /> Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeEntry) onDelete(activeEntry.id);
            handleCloseMenu();
          }}
          className="text-xs font-semibold text-red-600 flex items-center gap-2 py-2"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" /> Excluir
        </MenuItem>
      </Menu>
    </div>
  );
}
