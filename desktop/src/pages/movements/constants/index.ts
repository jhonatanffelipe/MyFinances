import * as yup from 'yup';

export const movementSchema = yup.object().shape({
  description: yup.string().required('Descrição é obrigatória').min(2, 'Mínimo de 2 caracteres'),
  amount: yup
    .number()
    .typeError('Valor inválido')
    .positive('O valor deve ser positivo')
    .required('Valor é obrigatório'),
  date: yup.string().required('Data é obrigatória'),
  type: yup.string().oneOf(['INCOME', 'EXPENSE']).required('Tipo é obrigatório'),
  category_id: yup
    .number()
    .typeError('Selecione uma categoria')
    .required('Categoria é obrigatória'),
  credit_card_id: yup
    .number()
    .transform((val) => (isNaN(val) || val === '' ? null : val))
    .nullable()
    .optional(),
  notes: yup.string().optional(),
});

export type MovementFormData = yup.InferType<typeof movementSchema>;
