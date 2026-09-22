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
import { Category } from '../../../types/database';
import TablePagination from '../../../components/Table/TablePagination';

interface CategoryListProps {
  categories: Category[];
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
  onEdit: (cat: Category) => void;
  onDelete: (id: number) => void;
}

export function CategoryList({
  categories,
  loading,
  totalRows,
  currentPage,
  perPage,
  search,
  orderField = 'name',
  orderDirection = 'asc',
  setCurrentPage,
  setPerPage,
  handlePagination,
  handleSearchChange,
  onEdit,
  onDelete,
}: CategoryListProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, cat: Category) => {
    setAnchorEl(event.currentTarget);
    setActiveCategory(cat);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveCategory(null);
  };

  const renderStatusBadge = (limit?: number | null, consumed: number = 0) => {
    if (!limit || limit <= 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
          Sem limite
        </span>
      );
    }
    const ratio = consumed / limit;
    if (ratio >= 1) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          Atingido
        </span>
      );
    }
    if (ratio >= 0.8) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          Próximo do limite
        </span>
      );
    }
    if (ratio >= 0.4) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
          Dentro do limite
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        Baixo uso
      </span>
    );
  };

  if (loading && categories.length === 0) {
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
            placeholder="Buscar por nome ou ícone"
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
            {totalRows} {totalRows === 1 ? 'categoria cadastrada' : 'categorias cadastradas'}
          </span>
        </div>
      </div>

      {/* Categories Table */}
      <Paper className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white">
        <TableContainer>
          <Table>
            <TableHead className="bg-slate-50/50">
              <TableRow>
                <TableCell width={60} className="font-bold text-xs text-slate-500 uppercase">
                  Ações
                </TableCell>
                <TableCell className="font-bold text-xs text-slate-500 uppercase">
                  Nome da categoria
                </TableCell>
                <TableCell width={120} className="font-bold text-xs text-slate-500 uppercase text-center">
                  Cor do gráfico
                </TableCell>
                <TableCell className="font-bold text-xs text-slate-500 uppercase">
                  Limite mensal
                </TableCell>
                <TableCell className="font-bold text-xs text-slate-500 uppercase">
                  Consumido
                </TableCell>
                <TableCell width={140} className="font-bold text-xs text-slate-500 uppercase">
                  Status
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    Nenhuma categoria encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((row) => (
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
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm leading-tight">{row.name}</p>
                        {row.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">{row.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className="w-3.5 h-3.5 rounded-full inline-block shadow-sm"
                        style={{ backgroundColor: row.color || '#94a3b8' }}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-700 font-mono">
                      {formatCurrency(row.monthly_limit)}
                    </TableCell>
                    <TableCell className="text-sm font-bold text-slate-800 font-mono">
                      {formatCurrency(row.consumed || 0)}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(row.monthly_limit, row.consumed || 0)}
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
            if (activeCategory) onEdit(activeCategory);
            handleCloseMenu();
          }}
          className="text-xs font-semibold text-slate-700 flex items-center gap-2 py-2"
        >
          <Edit2 className="w-3.5 h-3.5 text-blue-600" /> Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (activeCategory) onDelete(activeCategory.id);
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
