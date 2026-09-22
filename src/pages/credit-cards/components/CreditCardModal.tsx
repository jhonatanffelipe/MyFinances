import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
} from '@mui/material';
import { X } from 'lucide-react';
import { CreditCard } from '../../../types/database';
import { creditCardSchema, CreditCardFormData, CARD_PRESET_COLORS } from '../constants';
import { MaskedNumberField } from '../../../components/MaskedField/MaskedNumberField';

interface CreditCardModalProps {
  open: boolean;
  card: CreditCard | null;
  onClose: () => void;
  onSubmit: (data: CreditCardFormData) => Promise<void>;
}

export function CreditCardModal({ open, card, onClose, onSubmit }: CreditCardModalProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreditCardFormData>({
    resolver: yupResolver(creditCardSchema) as any,
    defaultValues: {
      description: '',
      color: '#8b5cf6',
      due_day: 5,
    },
  });

  const selectedColor = watch('color');

  useEffect(() => {
    if (card) {
      reset({
        description: card.description,
        color: card.color || '#8b5cf6',
        due_day: card.due_day,
      });
    } else {
      reset({
        description: '',
        color: '#8b5cf6',
        due_day: 5,
      });
    }
  }, [card, open, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        className: 'rounded-3xl p-2 shadow-2xl border border-slate-100',
      }}
    >
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div>
          <DialogTitle className="p-0 font-bold text-xl text-slate-900 leading-tight">
            {card ? 'Editar cartão' : 'Cadastrar cartão'}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Defina limites de crédito, bandeira, vencimento e cor para uso nos gráficos.
          </p>
        </div>
        <IconButton size="small" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)}>
        <DialogContent className="space-y-4 px-6 pt-2 pb-4">
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
              placeholder="Ex: Cartão principal, Nubank, Visa Infinite..."
              variant="outlined"
            />
          </div>

          {/* Cor de Identificação */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Cor de identificação
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={selectedColor || '#8b5cf6'}
                onChange={(e) => setValue('color', e.target.value)}
                className="w-9 h-9 p-0.5 rounded-xl border border-slate-200 cursor-pointer bg-white"
              />
              <span className="text-xs font-mono text-slate-500 uppercase">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CARD_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue('color', c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {errors.color && <p className="text-xs text-red-500 mt-1">{errors.color.message}</p>}
          </div>

          {/* Dia de Vencimento */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Dia de vencimento
            </label>
            <MaskedNumberField
              control={control}
              name="due_day"
              variant="day"
              placeholder="Dia (1 a 31)"
            />
          </div>
        </DialogContent>

        <div className="px-6 pb-2 text-[11px] text-slate-400">
          Identifique o cartão facilmente pelas cores nos gráficos.
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
            {isSubmitting ? 'Salvando...' : card ? 'Atualizar cartão' : 'Salvar cartão'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
