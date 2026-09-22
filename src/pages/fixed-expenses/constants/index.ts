import * as yup from 'yup';

export const fixedExpenseSchema = yup.object().shape({
  description: yup.string().required('Descrição é obrigatória').min(2, 'Mínimo de 2 caracteres'),
  amount: yup
    .number()
    .typeError('Valor inválido')
    .positive('O valor deve ser positivo')
    .required('Valor é obrigatório'),
  due_day: yup
    .number()
    .typeError('Dia inválido')
    .required('Dia do vencimento é obrigatório')
    .min(1, 'Mínimo dia 1')
    .max(31, 'Máximo dia 31'),
  category_id: yup
    .number()
    .typeError('Selecione uma categoria')
    .required('Categoria é obrigatória'),
  credit_card_id: yup
    .number()
    .transform((val) => (isNaN(val) || val === '' ? null : val))
    .nullable()
    .optional(),
  recurrence: yup.string().default('MONTHLY'),
  start_date: yup.string().required('Data de início é obrigatória'),
  end_date: yup
    .string()
    .required('Data de fim é obrigatória')
    .test('end-after-start', 'Data de fim deve ser posterior à data de início', function (value) {
      const { start_date } = this.parent;
      if (!value || !start_date) return false;
      return value > start_date;
    }),
  active: yup.number().default(1),
  notes: yup.string().optional(),
});

export type FixedExpenseFormData = yup.InferType<typeof fixedExpenseSchema>;
