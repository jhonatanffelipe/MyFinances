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
import { CreditCard } from '../../../types/database';
import TablePagination from '../../../components/Table/TablePagination';

interface CreditCardTableProps {
  cards: CreditCard[];
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
  onEdit: (card: CreditCard) => void;
  onDelete: (id: number) => void;
}

export function CreditCardTable({
  cards,
  loading,
  totalRows,
  currentPage,
  perPage,
  search,
  orderField = 'description',
  orderDirection = 'asc',
  setCurrentPage,
  setPerPage,
  handlePagination,
  handleSearchChange,
  onEdit,
  onDelete,
}: CreditCardTableProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeCard, setActiveCard] = useState<CreditCard | null>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, card: CreditCard) => {
    setAnchorEl(event.currentTarget);
    setActiveCard(card);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveCard(null);
  };

  if (loading && cards.length === 0) {
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
            placeholder="Buscar por nome ou final do cartão"
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
            {totalRows} {totalRows === 1 ? 'cartão cadastrado' : 'cartões cadastrados'}
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
                <TableCell className="font-bold text-xs text-slate-500 uppercase">
                  Descrição
                </TableCell>
                <TableCell width={120} className="font-bold text-xs text-slate-500 uppercase">
                  Cor
                </TableCell>
                <TableCell width={160} className="font-bold text-xs text-slate-500 uppercase">
                  Vencimento
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-slate-400 text-sm">
                    Nenhum cartão de crédito cadastrado ou encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((row) => (
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
                    <TableCell className="font-semibold text-slate-800 text-sm">
                      {row.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                          style={{ backgroundColor: row.color || '#8b5cf6' }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-600 font-mono">
                      Dia {String(row.due_day).padStart(2, '0')}
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
          className: 'rounded-xl shadow-lg border border-slate-100 min-w-[140px]',
        }}
      >
        <MenuItem
          onClick={() => {
            if (activeCard) onEdit(activeCard);
            handleCloseMenu();
          }}
          className="text-xs font-semibold text-slate-700 flex items-center gap-2 py-2"
        >
          <Edit2 className="w-3.5 h-3.5 text-blue-600" /> Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeCard) onDelete(activeCard.id);
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
