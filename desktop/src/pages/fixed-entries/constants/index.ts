import * as yup from 'yup';
import { TransactionType } from '../../../types/database';

/**
 * Lançamentos fixos (recorrentes) — o mesmo módulo atende despesas e receitas.
 * O que muda entre os dois é apenas o texto da interface e o uso de cartão de crédito.
 */
export const fixedEntrySchema = yup.object().shape({
  description: yup.string().required('Descrição é obrigatória').min(2, 'Mínimo de 2 caracteres'),
  amount: yup
    .number()
    .typeError('Valor inválido')
    .positive('O valor deve ser positivo')
    .required('Valor é obrigatório'),
  due_day: yup
    .number()
    .typeError('Dia inválido')
    .required('Dia é obrigatório')
    .min(1, 'Mínimo dia 1')
    .max(31, 'Máximo dia 31'),
  category_id: yup.string().required('Selecione uma categoria'),
  credit_card_id: yup.string().optional(),
  /** Responsável (De quem). Vazio = ninguém em específico. */
  member_id: yup.string().optional(),
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

export type FixedEntryFormData = yup.InferType<typeof fixedEntrySchema>;

export interface FixedEntryCopy {
  /** Texto da seção acima da tabela */
  sectionTitle: string;
  sectionSubtitle: string;
  newButton: string;
  /** Tabela */
  searchPlaceholder: string;
  dayColumn: string;
  amountColumn: string;
  emptyMessage: string;
  countSingular: string;
  countPlural: string;
  dayPrefix: string;
  /** Destaque do valor na listagem */
  amountClassName: string;
  /** Modal */
  modalCreateTitle: string;
  modalEditTitle: string;
  modalSubtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  amountLabel: string;
  dayLabel: string;
  dayPlaceholder: string;
  submitCreate: string;
  submitEdit: string;
  footerHint: string;
  deleteConfirm: string;
  /** Cartão de crédito só se aplica a despesas */
  showCreditCard: boolean;
}

export const FIXED_ENTRY_COPY: Record<TransactionType, FixedEntryCopy> = {
  EXPENSE: {
    sectionTitle: 'Contas Recorrentes Ativas',
    sectionSubtitle: 'Movimentos criados automaticamente para cada mês do período configurado.',
    newButton: 'Nova Despesa Fixa',
    searchPlaceholder: 'Buscar por descrição ou categoria',
    dayColumn: 'Venc.',
    amountColumn: 'Valor estimado',
    emptyMessage: 'Nenhuma despesa fixa encontrada.',
    countSingular: 'conta cadastrada',
    countPlural: 'contas cadastradas',
    dayPrefix: 'Dia',
    amountClassName: 'text-slate-900',
    modalCreateTitle: 'Nova despesa fixa',
    modalEditTitle: 'Editar despesa fixa',
    modalSubtitle: 'Cadastre uma nova despesa recorrente para acompanhamento mensal.',
    nameLabel: 'Nome da despesa',
    namePlaceholder: 'Ex: Conta de luz, Netflix, Aluguel...',
    amountLabel: 'Valor estimado',
    dayLabel: 'Vencimento',
    dayPlaceholder: 'Dia (1 a 31)',
    submitCreate: 'Salvar despesa fixa',
    submitEdit: 'Atualizar despesa',
    footerHint:
      'Campos obrigatórios: nome, valor, vencimento, categoria, data de início e data de fim. Os movimentos serão criados automaticamente para cada mês do período.',
    deleteConfirm:
      'Tem certeza que deseja excluir esta despesa fixa?\nTodos os movimentos vinculados também serão removidos.',
    showCreditCard: true,
  },
  INCOME: {
    sectionTitle: 'Receitas Recorrentes Ativas',
    sectionSubtitle: 'Movimentos de entrada criados automaticamente para cada mês do período configurado.',
    newButton: 'Nova Receita Fixa',
    searchPlaceholder: 'Buscar por descrição ou categoria',
    dayColumn: 'Receb.',
    amountColumn: 'Valor previsto',
    emptyMessage: 'Nenhuma receita fixa encontrada.',
    countSingular: 'receita cadastrada',
    countPlural: 'receitas cadastradas',
    dayPrefix: 'Dia',
    amountClassName: 'text-emerald-600',
    modalCreateTitle: 'Nova receita fixa',
    modalEditTitle: 'Editar receita fixa',
    modalSubtitle: 'Cadastre uma nova entrada recorrente para acompanhamento mensal.',
    nameLabel: 'Nome da receita',
    namePlaceholder: 'Ex: Salário, Aluguel recebido, Pró-labore...',
    amountLabel: 'Valor previsto',
    dayLabel: 'Dia do recebimento',
    dayPlaceholder: 'Dia (1 a 31)',
    submitCreate: 'Salvar receita fixa',
    submitEdit: 'Atualizar receita',
    footerHint:
      'Campos obrigatórios: nome, valor, dia do recebimento, categoria, data de início e data de fim. Os movimentos serão criados automaticamente para cada mês do período.',
    deleteConfirm:
      'Tem certeza que deseja excluir esta receita fixa?\nTodos os movimentos vinculados também serão removidos.',
    showCreditCard: false,
  },
};
