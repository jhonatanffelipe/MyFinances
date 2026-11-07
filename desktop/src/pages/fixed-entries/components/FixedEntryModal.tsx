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
} from '@mui/material';
import { X } from 'lucide-react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Category, CreditCard, FixedExpense } from '../../../types/database';
import { fixedEntrySchema, FixedEntryFormData, FixedEntryCopy } from '../constants';
import { MaskedNumberField } from '../../../components/MaskedField/MaskedNumberField';
import { MemberSelect } from '../../../components/Members/MemberSelect';
import { useAppState } from '../../../contexts/AppStateContext';

interface FixedEntryModalProps {
  copy: FixedEntryCopy;
  open: boolean;
  entry: FixedExpense | null;
  categories: Category[];
  creditCards: CreditCard[];
  onClose: () => void;
  onSubmit: (data: FixedEntryFormData) => Promise<void>;
}

export function FixedEntryModal({
  copy,
  open,
  entry,
  categories,
  creditCards,
  onClose,
  onSubmit,
}: FixedEntryModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const { state } = useAppState();

  const emptyValues = {
    description: '',
    amount: '' as any,
    due_day: 10,
    start_date: todayStr,
    end_date: '',
    category_id: '',
    credit_card_id: '',
    member_id: state.user?.id ?? '',
    recurrence: 'MONTHLY',
    active: 1,
    notes: '',
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FixedEntryFormData>({
    resolver: yupResolver(fixedEntrySchema) as any,
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (entry) {
      reset({
        description: entry.description,
        amount: entry.amount,
        due_day: entry.due_day,
        start_date: entry.start_date,
        end_date: entry.end_date || '',
        category_id: entry.category_id ?? '',
        credit_card_id: entry.credit_card_id ?? '',
        member_id: entry.member_id ?? '',
        recurrence: entry.recurrence || 'MONTHLY',
        active: entry.active,
        notes: entry.notes || '',
      });
    } else {
      reset(emptyValues);
    }
  }, [entry, open, reset]);

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
            {entry ? copy.modalEditTitle : copy.modalCreateTitle}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">{copy.modalSubtitle}</p>
        </div>
        <IconButton size="small" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)}>
        <DialogContent className="space-y-4 px-6 pt-2 pb-4">
          {/* Nome do lançamento */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              {copy.nameLabel}
            </label>
            <TextField
              {...register('description')}
              fullWidth
              size="small"
              error={!!errors.description}
              helperText={errors.description?.message}
              placeholder={copy.namePlaceholder}
              variant="outlined"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                {copy.amountLabel}
              </label>
              <MaskedNumberField
                control={control}
                name="amount"
                variant="money"
                placeholder="0,00"
              />
            </div>

            {/* Dia de vencimento / recebimento */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                {copy.dayLabel}
              </label>
              <MaskedNumberField
                control={control}
                name="due_day"
                variant="day"
                placeholder={copy.dayPlaceholder}
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
                              style={{ backgroundColor: cat.color || '#94a3b8' }}
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

          {/* Responsável */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">De quem</label>
            <Controller
              name="member_id"
              control={control}
              render={({ field }) => (
                <MemberSelect value={field.value ?? ''} onChange={field.onChange} emptyLabel="Ninguém em específico (família)" />
              )}
            />
          </div>

          {/* Cartão de crédito — apenas para despesas fixas */}
          {copy.showCreditCard && (
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
          )}
        </DialogContent>

        <div className="px-6 pb-2 text-[11px] text-slate-400">{copy.footerHint}</div>

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
            {isSubmitting ? 'Salvando...' : entry ? copy.submitEdit : copy.submitCreate}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
