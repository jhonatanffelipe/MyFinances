import * as yup from 'yup';

export const categorySchema = yup.object().shape({
  name: yup.string().required('Nome é obrigatório').min(2, 'Mínimo de 2 caracteres'),
  description: yup.string().optional(),
  type: yup.string().oneOf(['INCOME', 'EXPENSE']).required(),
  color: yup.string().required('Selecione uma cor'),
  icon: yup.string().optional(),
  monthly_limit: yup
    .number()
    .transform((val) => (isNaN(val) || val === '' ? null : val))
    .nullable()
    .min(0, 'Limite não pode ser negativo')
    .optional(),
});

export type CategoryFormData = yup.InferType<typeof categorySchema>;

export const COLOR_OPTIONS = [
  '#1e293b', // Chumbo / Moradia
  '#10b981', // Verde Esmeralda / Alimentação
  '#3b82f6', // Azul / Transporte
  '#f59e0b', // Laranja / Lazer
  '#ec4899', // Rosa / Saúde
  '#8b5cf6', // Roxo / Educação
  '#94a3b8', // Cinza / Outros
  '#ef4444', // Vermelho
];
