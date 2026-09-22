import * as yup from 'yup';

export const creditCardSchema = yup.object().shape({
  description: yup.string().required('Descrição é obrigatória').min(2, 'Mínimo de 2 caracteres'),
  color: yup.string().required('Cor é obrigatória'),
  due_day: yup
    .number()
    .typeError('Dia inválido')
    .required('Dia de vencimento é obrigatório')
    .min(1, 'Mínimo dia 1')
    .max(31, 'Máximo dia 31'),
});

export type CreditCardFormData = yup.InferType<typeof creditCardSchema>;

export const CARD_PRESET_COLORS = [
  '#8b5cf6', // Roxo / Nubank
  '#1e293b', // Preto / Black / Visa Infinite
  '#f59e0b', // Laranja / Inter
  '#3b82f6', // Azul / XP / Itaú
  '#10b981', // Verde
  '#ef4444', // Vermelho / Santander
  '#ec4899', // Rosa
];
