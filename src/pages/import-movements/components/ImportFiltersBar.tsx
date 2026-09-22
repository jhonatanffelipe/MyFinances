import React, { useState } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  ShieldAlert,
  Tags,
  CreditCard as CreditCardIcon,
  X,
  Filter,
  Ban,
} from 'lucide-react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Menu,
  Tooltip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Category, CreditCard } from '../../../types/database';
import { StatusFilter } from '../types';

interface ImportFiltersBarProps {
  creditCards: CreditCard[];
  selectedCreditCardId: number | null;
  onCreditCardChange: (id: number | null) => void;
  invoiceDate: string;
  onInvoiceDateChange: (date: string) => void;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  excludeText: string;
  onExcludeTextChange: (text: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  categories: Category[];
  totalItemsCount: number;
  filteredCount: number;
  selectedCount: number;
  duplicateCount: number;
  invoicePaymentCount: number;
  onSelectAllVisible: () => void;
  onDeselectAllVisible: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeselectDuplicates: () => void;
  onBulkChangeCategory: (categoryId: number | null) => void;
}

export function ImportFiltersBar({
  creditCards,
  selectedCreditCardId,
  onCreditCardChange,
  invoiceDate,
  onInvoiceDateChange,
  filterText,
  onFilterTextChange,
  excludeText,
  onExcludeTextChange,
  statusFilter,
  onStatusFilterChange,
  categories,
  totalItemsCount,
  filteredCount,
  selectedCount,
  duplicateCount,
  invoicePaymentCount,
  onSelectAllVisible,
  onDeselectAllVisible,
  onSelectAll,
  onDeselectAll,
  onDeselectDuplicates,
  onBulkChangeCategory,
}: ImportFiltersBarProps) {
  const [categoryMenuAnchor, setCategoryMenuAnchor] = useState<null | HTMLElement>(null);

  const handleOpenCategoryMenu = (event: React.MouseEvent<HTMLElement>) => {
    setCategoryMenuAnchor(event.currentTarget);
  };

  const handleCloseCategoryMenu = () => {
    setCategoryMenuAnchor(null);
  };

  const handleSelectBulkCategory = (catId: number | null) => {
    onBulkChangeCategory(catId);
    handleCloseCategoryMenu();
  };

  const isFiltering = !!filterText.trim() || statusFilter !== 'ALL';

  return (
    <Paper className="p-4 rounded-2xl border border-slate-100 shadow-sm bg-white space-y-4">
      {/* Top Row: Cartão de Crédito + Data dos Movimentos + Busca por Texto */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Seletor de Cartão */}
        <div className="md:col-span-3">
          <FormControl fullWidth size="small">
            <InputLabel id="credit-card-select-label">
              Cartão de Crédito de Origem
            </InputLabel>
            <Select
              labelId="credit-card-select-label"
              value={selectedCreditCardId ?? ''}
              label="Cartão de Crédito de Origem"
              onChange={(e) => onCreditCardChange(e.target.value ? Number(e.target.value) : null)}
              className="rounded-xl text-xs bg-slate-50/60"
              startAdornment={
                <InputAdornment position="start">
                  <CreditCardIcon className="w-4 h-4 text-purple-500" />
                </InputAdornment>
              }
            >
              <MenuItem value="" className="text-xs">
                <em>Nenhum cartão vinculado</em>
              </MenuItem>
              {creditCards.map((card) => (
                <MenuItem key={card.id} value={card.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: card.color || '#8b5cf6' }}
                    />
                    <span className="font-semibold">{card.description}</span>
                    <span className="text-[11px] text-slate-400">
                      (Vence dia {card.due_day})
                    </span>
                  </div>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        {/* Data dos Movimentos (Vencimento da Fatura) */}
        <div className="md:col-span-3">
          <DatePicker
            label="Data dos Movimentos (Vencimento)"
            value={invoiceDate ? dayjs(invoiceDate) : null}
            onChange={(val) => {
              if (val && val.isValid()) {
                onInvoiceDateChange(val.format('YYYY-MM-DD'));
              } else {
                onInvoiceDateChange('');
              }
            }}
            slotProps={{
              textField: {
                size: 'small',
                fullWidth: true,
                InputProps: {
                  className: 'rounded-xl bg-slate-50/60 text-xs',
                },
              },
            }}
          />
        </div>

        {/* Campo de Busca de Estabelecimentos */}
        <div className="md:col-span-3">
          <TextField
            size="small"
            fullWidth
            label="Buscar por Nome"
            placeholder="Ex: Uber, Pix, Decathlon..."
            value={filterText}
            onChange={(e) => onFilterTextChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-4 h-4 text-slate-400" />
                </InputAdornment>
              ),
              endAdornment: filterText ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onFilterTextChange('')}>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </IconButton>
                </InputAdornment>
              ) : null,
              className: 'rounded-xl bg-slate-50/60 text-xs',
            }}
          />
        </div>

        {/* Campo para Desconsiderar Estabelecimentos */}
        <div className="md:col-span-3">
          <TextField
            size="small"
            fullWidth
            label="Desconsiderar Termo"
            placeholder="Ex: Pagamento, IOF..."
            value={excludeText}
            onChange={(e) => onExcludeTextChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Ban className="w-4 h-4 text-rose-400" />
                </InputAdornment>
              ),
              endAdornment: excludeText ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onExcludeTextChange('')}>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </IconButton>
                </InputAdornment>
              ) : null,
              className: 'rounded-xl bg-slate-50/60 text-xs',
            }}
          />
        </div>
      </div>

      {/* Middle Row: Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtro:</span>
        </span>

        <button
          type="button"
          onClick={() => onStatusFilterChange('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos ({totalItemsCount})
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange('SELECTED')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            statusFilter === 'SELECTED'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          Marcados para Importar ({selectedCount})
        </button>

        {duplicateCount > 0 && (
          <button
            type="button"
            onClick={() => onStatusFilterChange('DUPLICATES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'DUPLICATES'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Duplicatas ({duplicateCount})
          </button>
        )}

        {invoicePaymentCount > 0 && (
          <button
            type="button"
            onClick={() => onStatusFilterChange('INVOICE_PAYMENTS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'INVOICE_PAYMENTS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Pagamento de Fatura ({invoicePaymentCount})
          </button>
        )}

        <button
          type="button"
          onClick={() => onStatusFilterChange('UNCATEGORIZED')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            statusFilter === 'UNCATEGORIZED'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Sem Categoria
        </button>

        {isFiltering && (
          <span className="text-[11px] text-slate-400 ml-auto">
            Exibindo <strong className="text-slate-700">{filteredCount}</strong> de {totalItemsCount}
          </span>
        )}
      </div>

      {/* Bottom Row: Quick Batch Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Se houver filtro ativo, prioriza Selecionar Visíveis */}
          {isFiltering ? (
            <>
              <Tooltip title="Marca todas as linhas visíveis pelo filtro atual">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onSelectAllVisible}
                  startIcon={<CheckSquare className="w-3.5 h-3.5 text-emerald-600" />}
                  className="rounded-xl border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 normal-case font-semibold text-xs"
                >
                  Selecionar Visíveis ({filteredCount})
                </Button>
              </Tooltip>

              <Tooltip title="Desmarca todas as linhas visíveis pelo filtro atual">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onDeselectAllVisible}
                  startIcon={<Square className="w-3.5 h-3.5 text-slate-400" />}
                  className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 normal-case font-semibold text-xs"
                >
                  Desmarcar Visíveis
                </Button>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                size="small"
                variant="outlined"
                onClick={onSelectAll}
                startIcon={<CheckSquare className="w-3.5 h-3.5 text-emerald-600" />}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 normal-case font-semibold text-xs"
              >
                Selecionar Todos
              </Button>

              <Button
                size="small"
                variant="outlined"
                onClick={onDeselectAll}
                startIcon={<Square className="w-3.5 h-3.5 text-slate-400" />}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 normal-case font-semibold text-xs"
              >
                Desmarcar Todos
              </Button>
            </>
          )}

          {duplicateCount > 0 && (
            <Button
              size="small"
              variant="text"
              onClick={onDeselectDuplicates}
              startIcon={<ShieldAlert className="w-3.5 h-3.5 text-amber-500" />}
              className="text-amber-700 hover:bg-amber-50 normal-case font-medium text-xs rounded-xl"
            >
              Desmarcar Duplicatas
            </Button>
          )}
        </div>

        {/* Categorização em Lote dos itens filtrados */}
        <div>
          <Button
            size="small"
            variant="outlined"
            onClick={handleOpenCategoryMenu}
            startIcon={<Tags className="w-3.5 h-3.5 text-blue-500" />}
            className="rounded-xl border-blue-200 text-blue-700 bg-blue-50/30 hover:bg-blue-50 normal-case font-semibold text-xs"
          >
            Atribuir Categoria aos Visíveis ({filteredCount})
          </Button>

          <Menu
            anchorEl={categoryMenuAnchor}
            open={Boolean(categoryMenuAnchor)}
            onClose={handleCloseCategoryMenu}
            PaperProps={{ className: 'rounded-2xl shadow-lg border border-slate-100 max-h-80' }}
          >
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Aplicar em {filteredCount} lançamentos visíveis:
            </div>
            <MenuItem
              onClick={() => handleSelectBulkCategory(null)}
              className="text-xs text-slate-500"
            >
              <em>(Sem categoria)</em>
            </MenuItem>
            {categories.map((cat) => (
              <MenuItem
                key={cat.id}
                onClick={() => handleSelectBulkCategory(cat.id)}
                className="text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#94a3b8' }}
                  />
                  <span>{cat.name}</span>
                </div>
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>
    </Paper>
  );
}
