import * as yup from 'yup';

export const movementSchema = yup.object().shape({
  description: yup.string().required('Descrição é obrigatória').min(2, 'Mínimo de 2 caracteres'),
  amount: yup
    .number()
    .typeError('Valor inválido')
    .positive('O valor deve ser positivo')
    .required('Valor é obrigatório'),
  date: yup.string().required('Data é obrigatória'),
  type: yup.string().oneOf(['INCOME', 'EXPENSE', 'TRANSFER']).required('Tipo é obrigatório'),
  /** De quem é o lançamento (em transferência: quem envia). Vazio = usuário logado. */
  member_id: yup.string().optional(),
  /** Só em transferência: quem recebe. */
  to_member_id: yup
    .string()
    .when(['type', 'member_id'], ([type, memberId], schema) =>
      type === 'TRANSFER'
        ? schema
            .required('Informe quem recebe')
            .test('other-member', 'Escolha outro membro', (v) => !v || v !== memberId)
        : schema.optional(),
    ),
  category_id: yup
    .string()
    .when('type', ([type], schema) =>
      type === 'TRANSFER' ? schema.optional() : schema.required('Selecione uma categoria'),
    ),
  credit_card_id: yup.string().optional(),
  notes: yup.string().optional(),
});

export type MovementFormData = yup.InferType<typeof movementSchema>;
