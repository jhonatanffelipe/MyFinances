import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, RotateCcw, Calendar, FileSpreadsheet, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Category, CreditCard, MovementFilters as FiltersType } from '../../../types/database';

interface MovementFiltersProps {
  filters: FiltersType;
  categories: Category[];
  creditCards?: CreditCard[];
  onFilterChange: (newFilters: FiltersType) => void;
  onOpenCreate?: () => void;
}

export function MovementFilters({
  filters,
  categories,
  creditCards = [],
  onFilterChange,
  onOpenCreate,
}: MovementFiltersProps) {
  const navigate = useNavigate();
  const getBaseMonthDate = (): Date => {
    if (filters.startDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.startDate)) {
      const parts = filters.startDate.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, 1);
    }
    const now = new Date();
    now.setDate(1);
    now.setMonth(now.getMonth() + 1); // Mês atual mais 1 padrão
    return now;
  };

  const setMonthRange = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, baseDate.getMonth() + 1, 0).getDate();
    onFilterChange({
      ...filters,
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    });
  };

  const handlePreviousMonth = () => {
    const d = getBaseMonthDate();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    setMonthRange(d);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    now.setDate(1);
    now.setMonth(now.getMonth() + 1); // Mês atual mais 1
    setMonthRange(now);
  };

  const handleNextMonth = () => {
    const d = getBaseMonthDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    setMonthRange(d);
  };

  const handleClearFilters = () => {
    onFilterChange({
      startDate: '',
      endDate: '',
      categoryId: undefined,
      creditCardId: undefined,
      type: 'ALL',
      search: '',
      excludeSearch: '',
    });
  };

  return (
    <Paper className="p-4 border border-slate-100 shadow-sm rounded-2xl bg-white space-y-4">
      {/* Top Bar: Search Inputs + Botões de Ação */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 max-w-2xl">
          <div className="w-full sm:flex-1">
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar por descrição ou anotação..."
              value={filters.search || ''}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="w-4 h-4 text-slate-400" />
                  </InputAdornment>
                ),
                className: 'rounded-xl bg-slate-50/70 text-xs',
              }}
            />
          </div>

          <div className="w-full sm:flex-1">
            <TextField
              size="small"
              fullWidth
              placeholder="Desconsiderar termo..."
              value={filters.excludeSearch || ''}
              onChange={(e) => onFilterChange({ ...filters, excludeSearch: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Ban className="w-4 h-4 text-rose-400" />
                  </InputAdornment>
                ),
                className: 'rounded-xl bg-slate-50/70 text-xs',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            variant="outlined"
            onClick={() => navigate('/movements/import')}
            startIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl px-4 py-2.5 normal-case whitespace-nowrap text-xs"
          >
            Importar Fatura
          </Button>

          {onOpenCreate && (
            <Button
              variant="contained"
              onClick={onOpenCreate}
              startIcon={<Plus className="w-4 h-4" />}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 shadow-none normal-case whitespace-nowrap text-xs"
            >
              Nova Transação
            </Button>
          )}
        </div>
      </div>

      {/* Filter Fields Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 border-t border-slate-100">
        {/* De */}
        <DatePicker
          label="De"
          value={filters.startDate ? dayjs(filters.startDate) : null}
          onChange={(val) => {
            if (val && val.isValid()) {
              onFilterChange({ ...filters, startDate: val.format('YYYY-MM-DD') });
            } else {
              onFilterChange({ ...filters, startDate: '' });
            }
          }}
          slotProps={{
            textField: {
              size: 'small',
              fullWidth: true,
              InputProps: { className: 'rounded-xl text-xs' },
            },
          }}
        />

        {/* Até */}
        <DatePicker
          label="Até"
          value={filters.endDate ? dayjs(filters.endDate) : null}
          onChange={(val) => {
            if (val && val.isValid()) {
              onFilterChange({ ...filters, endDate: val.format('YYYY-MM-DD') });
            } else {
              onFilterChange({ ...filters, endDate: '' });
            }
          }}
          slotProps={{
            textField: {
              size: 'small',
              fullWidth: true,
              InputProps: { className: 'rounded-xl text-xs' },
            },
          }}
        />

        {/* Categoria */}
        <FormControl size="small" fullWidth>
          <InputLabel className="text-xs">Categoria</InputLabel>
          <Select
            value={filters.categoryId ?? ''}
            label="Categoria"
            onChange={(e) =>
              onFilterChange({
                ...filters,
                categoryId: e.target.value !== '' ? Number(e.target.value) : undefined,
              })
            }
            className="rounded-xl text-xs"
          >
            <MenuItem value="">Todas as categorias</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: cat.color || '#64748b' }}
                  />
                  {cat.name}
                </span>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Tipo */}
        <FormControl size="small" fullWidth>
          <InputLabel className="text-xs">Tipo</InputLabel>
          <Select
            value={filters.type || 'ALL'}
            label="Tipo"
            onChange={(e) => onFilterChange({ ...filters, type: e.target.value as any })}
            className="rounded-xl text-xs"
          >
            <MenuItem value="ALL" className="text-xs">Todos os tipos</MenuItem>
            <MenuItem value="INCOME" className="text-xs">Entradas</MenuItem>
            <MenuItem value="EXPENSE" className="text-xs">Saídas</MenuItem>
          </Select>
        </FormControl>

        {/* Cartão de Crédito / Forma */}
        <FormControl size="small" fullWidth>
          <InputLabel className="text-xs">Forma / Cartão</InputLabel>
          <Select
            value={filters.creditCardId ?? ''}
            label="Forma / Cartão"
            onChange={(e) =>
              onFilterChange({
                ...filters,
                creditCardId: e.target.value !== '' ? Number(e.target.value) : undefined,
              })
            }
            className="rounded-xl text-xs"
          >
            <MenuItem value="">Todos os cartões / Dinheiro</MenuItem>
            {creditCards.map((card) => (
              <MenuItem key={card.id} value={card.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: card.color || '#8b5cf6' }}
                  />
                  {card.description}
                </span>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {/* Bottom Actions Row: Navegação de Mês on left, Limpar Filtros on right */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-50 text-xs">
        <div className="flex items-center gap-1">
          <Button
            size="small"
            variant="text"
            onClick={handlePreviousMonth}
            startIcon={<ChevronLeft className="w-3.5 h-3.5 text-slate-500" />}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 normal-case font-medium text-xs px-2.5 py-1 rounded-lg"
          >
            Mês anterior
          </Button>

          <Button
            size="small"
            variant="text"
            onClick={handleCurrentMonth}
            startIcon={<Calendar className="w-3.5 h-3.5 text-emerald-600" />}
            className="text-emerald-700 hover:bg-emerald-50 normal-case font-semibold text-xs px-2.5 py-1 rounded-lg"
          >
            Mês atual
          </Button>

          <Button
            size="small"
            variant="text"
            onClick={handleNextMonth}
            endIcon={<ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 normal-case font-medium text-xs px-2.5 py-1 rounded-lg"
          >
            Próximo mês
          </Button>
        </div>

        <Button
          size="small"
          variant="text"
          onClick={handleClearFilters}
          startIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 normal-case font-medium text-xs px-2.5 py-1 rounded-lg"
        >
          Limpar filtros
        </Button>
      </div>
    </Paper>
  );
}
