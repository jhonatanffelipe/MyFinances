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
  RadioGroup,
  FormControlLabel,
  Radio,
  MenuItem,
  Select,
  InputLabel,
  FormHelperText,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { X } from 'lucide-react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Category, CreditCard, Movement } from '../../../types/database';
import { movementSchema, MovementFormData } from '../constants';
import { MaskedNumberField } from '../../../components/MaskedField/MaskedNumberField';
import { MemberSelect } from '../../../components/Members/MemberSelect';
import { useAppState } from '../../../contexts/AppStateContext';

interface MovementModalProps {
  open: boolean;
  movement: Movement | null;
  categories: Category[];
  creditCards?: CreditCard[];
  onClose: () => void;
  onSubmit: (data: MovementFormData) => Promise<void>;
}

export function MovementModal({
  open,
  movement,
  categories,
  creditCards = [],
  onClose,
  onSubmit,
}: MovementModalProps) {
  const { state } = useAppState();
  const currentUserId = state.user?.id ?? '';
  const emptyForm = (): MovementFormData => ({
    description: '',
    amount: '' as any,
    date: new Date().toISOString().split('T')[0],
    type: 'EXPENSE',
    member_id: currentUserId,
    to_member_id: '',
    category_id: '',
    credit_card_id: '',
    notes: '',
  });
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MovementFormData>({
    resolver: yupResolver(movementSchema) as any,
    defaultValues: emptyForm(),
  });

  const selectedType = watch('type');
  const selectedMember = watch('member_id');
  const isTransfer = selectedType === 'TRANSFER';

  useEffect(() => {
    if (movement) {
      reset({
        description: movement.description,
        amount: movement.amount,
        date: movement.date,
        type: movement.type,
        member_id: movement.member_id ?? currentUserId,
        to_member_id: movement.to_member_id ?? '',
        category_id: movement.category_id ?? '',
        credit_card_id: movement.credit_card_id ?? '',
        notes: movement.notes || '',
      });
    } else {
      reset(emptyForm());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movement, open, reset, currentUserId]);

  const availableCategories = categories.filter((c) => c.type === selectedType);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}
    >
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div>
          <DialogTitle className="p-0 font-bold text-xl text-slate-900 leading-tight">
            {movement ? 'Editar movimentação' : 'Nova transação'}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Lance uma receita, despesa ou transferência entre membros da família.
          </p>
        </div>
        <IconButton size="small" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)}>
        <DialogContent className="space-y-4 px-6 pt-2 pb-4">
          {/* Tipo de Lançamento */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Tipo de Lançamento
            </label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  row
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    setValue('category_id', '');
                    if (e.target.value === 'TRANSFER') setValue('credit_card_id', '');
                    else setValue('to_member_id', '');
                  }}
                >
                  <FormControlLabel
                    value="EXPENSE"
                    control={<Radio color="error" />}
                    label={<span className="text-sm font-semibold text-slate-800">Despesa</span>}
                  />
                  <FormControlLabel
                    value="INCOME"
                    control={<Radio color="success" />}
                    label={<span className="text-sm font-semibold text-slate-800">Receita</span>}
                  />
                  <FormControlLabel
                    value="TRANSFER"
                    control={<Radio color="info" />}
                    label={<span className="text-sm font-semibold text-slate-800">Transferência</span>}
                  />
                </RadioGroup>
              )}
            />
          </div>

          {/* De quem / Para quem */}
          <div className={`grid grid-cols-1 gap-4 ${isTransfer ? 'sm:grid-cols-2' : ''}`}>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                {isTransfer ? 'De' : 'De quem'}
              </label>
              <Controller
                name="member_id"
                control={control}
                render={({ field }) => (
                  <MemberSelect value={field.value ?? ''} onChange={field.onChange} error={errors.member_id?.message} />
                )}
              />
            </div>
            {isTransfer && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Para</label>
                <Controller
                  name="to_member_id"
                  control={control}
                  render={({ field }) => (
                    <MemberSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      excludeId={selectedMember || undefined}
                      error={errors.to_member_id?.message}
                    />
                  )}
                />
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Descrição
            </label>
            <TextField
              {...register('description')}
              fullWidth
              size="small"
              error={!!errors.description}
              helperText={errors.description?.message}
              placeholder="Ex: Supermercado Pão de Açúcar, Salário mensal..."
              variant="outlined"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Valor */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Valor (R$)
              </label>
              <MaskedNumberField
                control={control}
                name="amount"
                variant="money"
                placeholder="0,00"
              />
            </div>

            {/* Data */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Data
              </label>
              <Controller
                name="date"
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
                        error: !!errors.date,
                        helperText: errors.date?.message,
                        variant: 'outlined',
                      },
                    }}
                  />
                )}
              />
            </div>
          </div>

          {isTransfer ? (
            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
              Transferência (mesada, repasse) não entra nos totais da família: sai de quem envia e entra para quem recebe.
            </p>
          ) : (
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
                      {availableCategories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
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
                    {errors.category_id && <FormHelperText>{errors.category_id.message}</FormHelperText>}
                  </FormControl>
                )}
              />
            </div>

            {/* Cartão de Crédito (apenas para despesas) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Cartão de Crédito
              </label>
              <Controller
                name="credit_card_id"
                control={control}
                render={({ field }) => (
                  <FormControl size="small" fullWidth disabled={selectedType === 'INCOME'}>
                    <Select {...field} displayEmpty variant="outlined">
                      <MenuItem value="">
                        <span className="text-slate-500">Nenhum / Dinheiro / Débito</span>
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
          </div>
          )}

          {/* Observações */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Observações (Opcional)
            </label>
            <TextField
              {...register('notes')}
              multiline
              rows={2}
              fullWidth
              size="small"
              placeholder="Ex: Pagamento parcelado, reembolso futuro..."
              variant="outlined"
            />
          </div>
        </DialogContent>

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
            {isSubmitting ? 'Salvando...' : movement ? 'Atualizar movimentação' : 'Salvar transação'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
