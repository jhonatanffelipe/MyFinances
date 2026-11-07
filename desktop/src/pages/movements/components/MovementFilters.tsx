import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  RotateCcw,
  Calendar,
  FileSpreadsheet,
  Ban,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react';
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
  ListSubheader,
  Collapse,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Category, CreditCard, MovementFilters as FiltersType } from '../../../types/database';
import { useAppState } from '../../../contexts/AppStateContext';
import { MemberAvatar } from '../../../components/Members/MemberAvatar';

interface MovementFiltersProps {
  filters: FiltersType;
  categories: Category[];
  creditCards?: CreditCard[];
  onFilterChange: (newFilters: FiltersType) => void;
  onOpenCreate?: () => void;
  onOpenBulkDelete?: () => void;
}

export function MovementFilters({
  filters,
  categories,
  creditCards = [],
  onFilterChange,
  onOpenCreate,
  onOpenBulkDelete,
}: MovementFiltersProps) {
  const navigate = useNavigate();
  const { state } = useAppState();
  const members = state.members;

  const [isFiltersVisible, setIsFiltersVisible] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('myfinances_movements_filters_visible');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleFiltersVisible = () => {
    setIsFiltersVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('myfinances_movements_filters_visible', String(next));
      } catch {}
      return next;
    });
  };

  const activeFiltersCount = [
    Boolean(filters.startDate || filters.endDate),
    Boolean(filters.categoryId),
    Boolean(filters.type && filters.type !== 'ALL'),
    Boolean(filters.creditCardId !== undefined),
    Boolean(filters.memberId),
  ].filter(Boolean).length;

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
      memberId: undefined,
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

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          <Button
            variant="outlined"
            onClick={toggleFiltersVisible}
            startIcon={<Filter className={`w-4 h-4 ${isFiltersVisible ? 'text-emerald-600' : 'text-slate-500'}`} />}
            endIcon={isFiltersVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            className={`font-semibold rounded-xl px-3.5 py-2.5 normal-case whitespace-nowrap text-xs transition-colors ${
              isFiltersVisible
                ? 'border-emerald-200 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/60'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isFiltersVisible ? 'Ocultar filtros' : 'Exibir filtros'}
            {activeFiltersCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <Button
            variant="outlined"
            onClick={() => navigate('/movements/import')}
            startIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl px-4 py-2.5 normal-case whitespace-nowrap text-xs"
          >
            Importar Fatura
          </Button>

          {onOpenBulkDelete && (
            <Button
              variant="outlined"
              onClick={onOpenBulkDelete}
              startIcon={<Trash2 className="w-4 h-4 text-red-500" />}
              className="border-slate-200 hover:bg-red-50 text-slate-700 font-semibold rounded-xl px-4 py-2.5 normal-case whitespace-nowrap text-xs"
            >
              Excluir por Cartão
            </Button>
          )}

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

      <Collapse in={isFiltersVisible}>
        <div className="space-y-4 pt-1">
          {/* Filter Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-1 border-t border-slate-100">
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
                categoryId: e.target.value !== '' ? String(e.target.value) : undefined,
              })
            }
            className="rounded-xl text-xs"
          >
            <MenuItem value="">Todas as categorias</MenuItem>
            {(filters.type === 'ALL' || !filters.type || filters.type === 'EXPENSE') &&
              categories.some((c) => c.type === 'EXPENSE') && (
                <ListSubheader className="text-[11px] font-bold text-rose-700 bg-rose-50/70 py-1 leading-normal">
                  Despesas
                </ListSubheader>
              )}
            {(filters.type === 'ALL' || !filters.type || filters.type === 'EXPENSE') &&
              categories
                .filter((cat) => cat.type === 'EXPENSE')
                .map((cat) => (
                  <MenuItem key={cat.id} value={cat.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                        style={{ backgroundColor: cat.color || '#64748b' }}
                      />
                      <span>{cat.name}</span>
                    </span>
                  </MenuItem>
                ))}
            {(filters.type === 'ALL' || !filters.type || filters.type === 'INCOME') &&
              categories.some((c) => c.type === 'INCOME') && (
                <ListSubheader className="text-[11px] font-bold text-emerald-700 bg-emerald-50/70 py-1 leading-normal">
                  Receitas
                </ListSubheader>
              )}
            {(filters.type === 'ALL' || !filters.type || filters.type === 'INCOME') &&
              categories
                .filter((cat) => cat.type === 'INCOME')
                .map((cat) => (
                  <MenuItem key={cat.id} value={cat.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                        style={{ backgroundColor: cat.color || '#64748b' }}
                      />
                      <span>{cat.name}</span>
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
            <MenuItem value="TRANSFER" className="text-xs">Transferências</MenuItem>
          </Select>
        </FormControl>

        {/* Membro */}
        <FormControl size="small" fullWidth>
          <InputLabel className="text-xs">Membro</InputLabel>
          <Select
            value={filters.memberId ?? ''}
            label="Membro"
            onChange={(e) =>
              onFilterChange({ ...filters, memberId: e.target.value !== '' ? String(e.target.value) : undefined })
            }
            className="rounded-xl text-xs"
          >
            <MenuItem value="" className="text-xs">Toda a família</MenuItem>
            {members.map((m) => (
              <MenuItem key={m.user_id} value={m.user_id} className="text-xs">
                <span className="flex items-center gap-2">
                  <MemberAvatar name={m.name} avatarUrl={m.avatar_url} size={18} />
                  {m.name}
                  {!m.active && <span className="text-[10px] text-amber-600">(inativo)</span>}
                </span>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Cartão de Crédito / Forma */}
        <FormControl size="small" fullWidth>
          <InputLabel className="text-xs">Forma / Cartão</InputLabel>
          <Select
            value={filters.creditCardId ?? ''}
            label="Forma / Cartão"
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                onFilterChange({ ...filters, creditCardId: undefined });
              } else if (val === 'none' || val === 'all_ungrouped') {
                onFilterChange({ ...filters, creditCardId: val });
              } else {
                onFilterChange({ ...filters, creditCardId: String(val) });
              }
            }}
            className="rounded-xl text-xs"
          >
            <MenuItem value="" className="text-xs font-semibold text-emerald-800">
              Todos (Faturas de cartão agrupadas)
            </MenuItem>
            <MenuItem value="none" className="text-xs text-slate-700">
              Apenas Dinheiro / Conta (Sem cartão)
            </MenuItem>
            <MenuItem value="all_ungrouped" className="text-xs text-slate-500">
              Todos os lançamentos (Sem agrupar)
            </MenuItem>
            {creditCards.map((card) => (
              <MenuItem key={card.id} value={card.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: card.color || '#8b5cf6' }}
                  />
                  {card.description} (Lançamentos detalhados)
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
    </div>
  </Collapse>
</Paper>
  );
}
