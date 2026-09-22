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
  IconButton,
  InputAdornment,
} from '@mui/material';
import { X } from 'lucide-react';
import { Category } from '../../../types/database';
import { categorySchema, CategoryFormData, COLOR_OPTIONS } from '../constants';
import { MaskedNumberField } from '../../../components/MaskedField/MaskedNumberField';

interface CategoryModalProps {
  open: boolean;
  category: Category | null;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
}

export function CategoryModal({ open, category, onClose, onSubmit }: CategoryModalProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: yupResolver(categorySchema) as any,
    defaultValues: {
      name: '',
      description: '',
      type: 'EXPENSE',
      color: '#10b981',
      icon: 'Tag',
      monthly_limit: '' as any,
    },
  });

  const selectedColor = watch('color');

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
        type: category.type,
        color: category.color || '#10b981',
        icon: category.icon || 'Tag',
        monthly_limit: category.monthly_limit || ('' as any),
      });
    } else {
      reset({
        name: '',
        description: '',
        type: 'EXPENSE',
        color: '#10b981',
        icon: 'Tag',
        monthly_limit: '' as any,
      });
    }
  }, [category, open, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}
    >
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div>
          <DialogTitle className="p-0 font-bold text-xl text-slate-900 leading-tight">
            {category ? 'Editar categoria' : 'Cadastrar categoria'}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Defina informações visuais, limite mensal e cor para uso nos gráficos.
          </p>
        </div>
        <IconButton size="small" onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)}>
        <DialogContent className="space-y-4 px-6 pt-2 pb-4">
          {/* Nome da categoria */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Nome da categoria
            </label>
            <TextField
              {...register('name')}
              fullWidth
              size="small"
              error={!!errors.name}
              helperText={errors.name?.message}
              placeholder="Ex: Transporte, Moradia, Alimentação..."
              variant="outlined"
            />
          </div>

          {/* Descrição opcional */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Descrição opcional
            </label>
            <TextField
              {...register('description')}
              fullWidth
              multiline
              rows={2}
              size="small"
              placeholder="Ex: Combustível, estacionamento, passagem e manutenção do veículo."
              variant="outlined"
            />
          </div>

          {/* Cor do gráfico */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Cor do gráfico
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={selectedColor || '#10b981'}
                onChange={(e) => setValue('color', e.target.value)}
                className="w-9 h-9 p-0.5 rounded-xl border border-slate-200 cursor-pointer bg-white"
              />
              <span className="text-xs font-mono text-slate-500 uppercase">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
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

          {/* Limite mensal opcional */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Limite mensal opcional
            </label>
            <MaskedNumberField
              control={control}
              name="monthly_limit"
              variant="money"
              placeholder="0,00"
            />
          </div>
        </DialogContent>

        <div className="px-6 pb-2 text-[11px] text-slate-400">
          Campos opcionais: descrição e limite mensal.
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
            {isSubmitting ? 'Salvando...' : category ? 'Atualizar categoria' : 'Salvar categoria'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
