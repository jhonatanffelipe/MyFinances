import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  MenuItem,
  Select,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { X } from 'lucide-react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Category, CreditCard, FixedExpense } from '../../../types/database';
import { fixedExpenseSchema, FixedExpenseFormData } from '../constants';
import { MaskedNumberField } from '../../../components/MaskedField/MaskedNumberField';

interface FixedExpenseModalProps {
  open: boolean;
  expense: FixedExpense | null;
  categories: Category[];
  creditCards: CreditCard[];
  onClose: () => void;
  onSubmit: (data: FixedExpenseFormData) => Promise<void>;
}

export function FixedExpenseModal({
  open,
  expense,
  categories,
  creditCards,
  onClose,
  onSubmit,
}: FixedExpenseModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FixedExpenseFormData>({
    resolver: yupResolver(fixedExpenseSchema) as any,
    defaultValues: {
      description: '',
      amount: '' as any,
      due_day: 10,
      start_date: todayStr,
      end_date: '',
      category_id: '' as any,
      credit_card_id: '' as any,
      recurrence: 'MONTHLY',
      active: 1,
      notes: '',
    },
  });

  useEffect(() => {
    if (expense) {
      reset({
        description: expense.description,
        amount: expense.amount,
        due_day: expense.due_day,
        start_date: expense.start_date,
        end_date: expense.end_date || '',
        category_id: expense.category_id,
        credit_card_id: expense.credit_card_id || ('' as any),
        recurrence: expense.recurrence || 'MONTHLY',
        active: expense.active,
        notes: expense.notes || '',
      });
    } else {
      reset({
        description: '',
        amount: '' as any,
        due_day: 10,
        start_date: todayStr,
        end_date: '',
        category_id: '' as any,
        credit_card_id: '' as any,
        recurrence: 'MONTHLY',
        active: 1,
        notes: '',
      });
    }
  }, [expense, open, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'rounded-3xl p-2 shadow-2xl border border-slate-100',
      }}
    >
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div>
          <DialogTitle className="p-0 font-bold text-xl text-slate-900 leading-tight">
            {expense ? 'Editar despesa fixa' : 'Nova despesa fixa'}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre uma nova despesa recorrente para acompanhamento mensal.
          </p>
        </div>
        <IconButton size="small" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)}>
        <DialogContent className="space-y-4 px-6 pt-2 pb-4">
          {/* Nome da despesa */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Nome da despesa
            </label>
            <TextField
              {...register('description')}
              fullWidth
              size="small"
              error={!!errors.description}
              helperText={errors.description?.message}
              placeholder="Ex: Conta de luz, Netflix, Aluguel..."
              variant="outlined"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor estimado */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Valor estimado
              </label>
              <MaskedNumberField
                control={control}
                name="amount"
                variant="money"
                placeholder="0,00"
              />
            </div>

            {/* Vencimento */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Vencimento
              </label>
              <MaskedNumberField
                control={control}
                name="due_day"
                variant="day"
                placeholder="Dia (1 a 31)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Data de início */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Data de início
              </label>
              <Controller
                name="start_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(val) => {
                      if (val && val.isValid()) {
                        field.onChange(val.format('YYYY-MM-DD'));
                      } else {
                        field.onChange('');
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                        error: !!errors.start_date,
                        helperText: errors.start_date?.message,
                        variant: 'outlined',
                      },
                    }}
                  />
                )}
              />
            </div>

            {/* Data de fim */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Data de fim <span className="text-red-500">*</span>
              </label>
              <Controller
                name="end_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(val) => {
                      if (val && val.isValid()) {
                        field.onChange(val.format('YYYY-MM-DD'));
                      } else {
                        field.onChange('');
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                        error: !!errors.end_date,
                        helperText: errors.end_date?.message,
                        variant: 'outlined',
                      },
                    }}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Categoria */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Categoria
              </label>
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <FormControl size="small" fullWidth error={!!errors.category_id}>
                    <Select {...field} displayEmpty variant="outlined">
                      <MenuItem disabled value="">
                        <span className="text-slate-400">Selecione uma categoria</span>
                      </MenuItem>
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: cat.color || '#ea580c' }}
                            />
                            {cat.name}
                          </span>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </div>

            {/* Recorrência */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Recorrência
              </label>
              <Controller
                name="recurrence"
                control={control}
                render={({ field }) => (
                  <FormControl size="small" fullWidth>
                    <Select {...field} variant="outlined">
                      <MenuItem value="MONTHLY">Mensal</MenuItem>
                      <MenuItem value="BIMONTHLY">Bimestral</MenuItem>
                      <MenuItem value="QUARTERLY">Trimestral</MenuItem>
                      <MenuItem value="SEMIANNUAL">Semestral</MenuItem>
                      <MenuItem value="ANNUAL">Anual</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </div>
          </div>

          {/* Cartão de crédito opcional */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Cartão de crédito (opcional)
            </label>
            <Controller
              name="credit_card_id"
              control={control}
              render={({ field }) => (
                <FormControl size="small" fullWidth>
                  <Select {...field} displayEmpty variant="outlined">
                    <MenuItem value="">
                      <span className="text-slate-500">Nenhum / pagamento direto</span>
                    </MenuItem>
                    {creditCards.map((card) => (
                      <MenuItem key={card.id} value={card.id}>
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
              )}
            />
          </div>
        </DialogContent>

        <div className="px-6 pb-2 text-[11px] text-slate-400">
          Campos obrigatórios: nome, valor, vencimento, categoria, data de início e data de fim.
          Os movimentos serão criados automaticamente para cada mês do período.
        </div>

        <DialogActions className="px-6 pb-5 pt-2 border-t border-slate-100 flex justify-end gap-2">
          <Button
            onClick={onClose}
            variant="outlined"
            color="inherit"
            disabled={isSubmitting}
            className="rounded-xl normal-case font-semibold text-slate-600 border-slate-200"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            className="rounded-xl normal-case font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
          >
            {isSubmitting ? 'Salvando...' : expense ? 'Atualizar despesa' : 'Salvar despesa fixa'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
